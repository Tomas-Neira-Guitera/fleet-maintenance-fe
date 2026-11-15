import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/apiClient';
import { uploadDefectPhoto } from '../services/photosService';
import type { ChecklistItemDef, ChecklistItemState } from '../types/domain';
import { ChecklistItemCard } from './ChecklistItemCard';

vi.mock('../services/photosService', () => ({
  ACCEPTED_PHOTO_TYPES: 'image/jpeg,image/png',
  uploadDefectPhoto: vi.fn(),
}));

const uploadMock = vi.mocked(uploadDefectPhoto);

const LUCES: ChecklistItemDef = { id: 'ext-luces', label: 'Luces', type: 'check', section: 'exterior' };
const KM: ChecklistItemDef = { id: 'int-km', label: 'Kilómetros actuales', type: 'number', section: 'interior', required: true };

// La tarjeta es controlada: este envoltorio hace de InspectionFlow y guarda el estado.
function Harness({
  def = LUCES,
  initial = { outcome: 'ok' },
  showValidation = false,
  onState,
}: {
  def?: ChecklistItemDef;
  initial?: ChecklistItemState;
  showValidation?: boolean;
  onState?: (state: ChecklistItemState) => void;
}) {
  const [state, setState] = useState<ChecklistItemState>(initial);
  return (
    <ChecklistItemCard
      def={def}
      state={state}
      showValidation={showValidation}
      onChange={(next) => {
        setState(next);
        onState?.(next);
      }}
    />
  );
}

function photo(name = 'defecto.jpg', type = 'image/jpeg') {
  return new File(['x'], name, { type });
}

function fileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

async function reportDefect(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('switch', { name: 'Luces: reportar defecto' }));
}

describe('ChecklistItemCard — ítem numérico', () => {
  it('muestra el campo y guarda lo que se escribe', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(<Harness def={KM} initial={{}} onState={onState} />);

    await user.type(screen.getByLabelText('Kilómetros actuales'), '84320');

    expect(screen.getByLabelText('Kilómetros actuales')).toHaveValue(84320);
    expect(onState).toHaveBeenLastCalledWith({ numberValue: '84320' });
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('marca el campo obligatorio vacío solo al validar', () => {
    const { rerender } = render(<Harness def={KM} initial={{}} />);
    expect(screen.queryByText('Este campo es obligatorio.')).not.toBeInTheDocument();

    rerender(<Harness def={KM} initial={{}} showValidation />);
    expect(screen.getByText('Este campo es obligatorio.')).toBeInTheDocument();
  });
});

describe('ChecklistItemCard — control OK / defecto', () => {
  it('arranca en OK, sin la carga del defecto', () => {
    render(<Harness />);

    const toggle = screen.getByRole('switch', { name: 'Luces: reportar defecto' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('OK');
    expect(screen.queryByText('Gravedad')).not.toBeInTheDocument();
  });

  it('al reportar defecto despliega la carga, con "No bloqueante" y la foto opcional', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(<Harness onState={onState} />);

    await reportDefect(user);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch')).toHaveTextContent('Reportar defecto');
    expect(screen.getByRole('button', { name: 'No bloqueante' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bloqueante' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Foto (opcional)')).toBeInTheDocument();
    expect(onState).toHaveBeenLastCalledWith({
      outcome: 'defect',
      defect: { severity: 'non-blocking', description: '' },
    });
  });

  it('al pasar a bloqueante la foto pasa a ser obligatoria', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(<Harness onState={onState} />);
    await reportDefect(user);

    await user.click(screen.getByRole('button', { name: 'Bloqueante' }));

    expect(screen.getByRole('button', { name: 'Bloqueante' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Foto (obligatoria)')).toBeInTheDocument();
    expect(onState.mock.lastCall?.[0].defect.severity).toBe('blocking');
  });

  it('guarda título y descripción, y el título no pasa de 30 caracteres', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(<Harness onState={onState} />);
    await reportDefect(user);

    await user.type(screen.getByLabelText('Título (obligatorio)'), 'Foco trasero quemado y faro delantero roto');
    await user.type(screen.getByLabelText('Descripción (opcional)'), 'Se ve desde atrás');

    expect(screen.getByLabelText('Título (obligatorio)')).toHaveValue('Foco trasero quemado y faro de');
    expect(screen.getByText('30/30')).toBeInTheDocument();
    expect(onState.mock.lastCall?.[0].defect).toMatchObject({
      description: 'Foco trasero quemado y faro de',
      details: 'Se ve desde atrás',
    });
  });

  it('si se vuelve a OK, lo cargado queda en pantalla al reactivarlo', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(<Harness onState={onState} />);
    await reportDefect(user);
    await user.type(screen.getByLabelText('Título (obligatorio)'), 'Faro roto');

    await reportDefect(user);
    expect(onState.mock.lastCall?.[0]).toMatchObject({ outcome: 'ok', defect: { description: 'Faro roto' } });
    expect(screen.queryByLabelText('Título (obligatorio)')).not.toBeInTheDocument();

    await reportDefect(user);
    expect(screen.getByLabelText('Título (obligatorio)')).toHaveValue('Faro roto');
  });
});

describe('ChecklistItemCard — validación del defecto', () => {
  it('sin título pide la descripción', () => {
    render(
      <Harness initial={{ outcome: 'defect', defect: { severity: 'non-blocking', description: '  ' } }} showValidation />,
    );
    expect(screen.getByText('Agregá una descripción del defecto.')).toBeInTheDocument();
  });

  it('un no bloqueante con título es válido aunque no tenga foto', () => {
    render(
      <Harness initial={{ outcome: 'defect', defect: { severity: 'non-blocking', description: 'Espejo rayado' } }} showValidation />,
    );
    expect(screen.queryByText(/Agregá una descripción|necesitan foto/)).not.toBeInTheDocument();
  });

  it('un bloqueante sin foto no es válido', () => {
    render(
      <Harness initial={{ outcome: 'defect', defect: { severity: 'blocking', description: 'Sin frenos' } }} showValidation />,
    );
    expect(screen.getByText('Los defectos bloqueantes necesitan foto y descripción.')).toBeInTheDocument();
  });

  it('un bloqueante con título y foto es válido', () => {
    render(
      <Harness
        initial={{ outcome: 'defect', defect: { severity: 'blocking', description: 'Sin frenos', photoUrl: 'http://x/f.jpg' } }}
        showValidation
      />,
    );
    expect(screen.queryByText(/necesitan foto/)).not.toBeInTheDocument();
  });

  it('no muestra errores mientras no se pidió validar', () => {
    render(<Harness initial={{ outcome: 'defect', defect: { severity: 'blocking', description: '' } }} />);
    expect(screen.queryByText(/necesitan foto/)).not.toBeInTheDocument();
  });
});

describe('ChecklistItemCard — foto del defecto', () => {
  it('sube la foto al elegirla y la muestra', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    uploadMock.mockResolvedValue({ photoId: 'p1', photoUrl: 'http://localhost:8080/api/photos/p1' });
    const { container } = render(<Harness onState={onState} />);
    await reportDefect(user);

    const file = photo();
    await user.upload(fileInput(container), file);

    expect(uploadMock).toHaveBeenCalledWith(file);
    expect(await screen.findByAltText('Foto del defecto reportado')).toHaveAttribute(
      'src',
      'http://localhost:8080/api/photos/p1',
    );
    expect(onState.mock.lastCall?.[0]).toMatchObject({
      uploading: false,
      defect: { photoUrl: 'http://localhost:8080/api/photos/p1' },
    });
  });

  it('muestra "Subiendo…" mientras la foto se sube', async () => {
    const user = userEvent.setup();
    uploadMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Harness />);
    await reportDefect(user);

    await user.upload(fileInput(container), photo());

    expect(screen.getByText('Subiendo…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adjuntar foto' })).not.toBeInTheDocument();
  });

  it('si la subida falla muestra el motivo y deja volver a intentar', async () => {
    const user = userEvent.setup();
    uploadMock.mockRejectedValue(new ApiError(413, 'La foto pesa más de 8 MB.', 'PHOTO_TOO_LARGE'));
    const { container } = render(<Harness />);
    await reportDefect(user);

    await user.upload(fileInput(container), photo());

    expect(await screen.findByText('La foto pesa más de 8 MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adjuntar foto' })).toBeInTheDocument();
  });

  it('ante un error desconocido muestra un mensaje genérico', async () => {
    const user = userEvent.setup();
    uploadMock.mockRejectedValue(new Error('network'));
    const { container } = render(<Harness />);
    await reportDefect(user);

    await user.upload(fileInput(container), photo());

    expect(await screen.findByText('No se pudo subir la foto. Probá de nuevo.')).toBeInTheDocument();
  });

  it('"Quitar foto" la saca del defecto', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(
      <Harness
        initial={{ outcome: 'defect', defect: { severity: 'blocking', description: 'Sin frenos', photoUrl: 'http://x/f.jpg' } }}
        onState={onState}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Quitar foto' }));

    expect(screen.queryByAltText('Foto del defecto reportado')).not.toBeInTheDocument();
    expect(onState.mock.lastCall?.[0].defect.photoUrl).toBeUndefined();
  });

  it('el selector solo ofrece JPG y PNG y abre la cámara trasera', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await reportDefect(user);

    expect(fileInput(container)).toHaveAttribute('accept', 'image/jpeg,image/png');
    expect(fileInput(container)).toHaveAttribute('capture', 'environment');
  });
});

describe('ChecklistItemCard — dictado de la descripción', () => {
  it('sin soporte de reconocimiento de voz no ofrece dictar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await reportDefect(user);

    expect(screen.queryByRole('button', { name: /Dictar/ })).not.toBeInTheDocument();
  });

  it('con soporte ofrece el botón "Dictar"', async () => {
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult = null;
      onerror = null;
      onend = null;
      start() {}
      stop() {}
      abort() {}
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    try {
      const user = userEvent.setup();
      render(<Harness />);
      await reportDefect(user);

      expect(screen.getByRole('button', { name: /Dictar/ })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
