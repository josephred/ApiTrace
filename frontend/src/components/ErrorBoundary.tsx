import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card, EmptyState } from './ui';

interface State {
  failed: boolean;
}

/**
 * Red de seguridad de la interfaz.
 *
 * Sin esto, un error de render deja la pantalla en blanco y la persona no sabe
 * si se corto la señal, si perdio lo cargado o si el teléfono se colgo. Con
 * esto ve qué pasó y tiene una salida; los datos en cola siguen guardados en el
 * dispositivo, que es lo que realmente importa no perder.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ApiTrace] fallo de interfaz', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div style={{ padding: 'var(--sp-6)', maxWidth: 520, margin: '0 auto' }}>
        <Card>
          <EmptyState
            icon="warning"
            title="La pantalla no se pudo mostrar"
            description="Fue un problema nuestro, no algo que hayas hecho mal. Lo que registraste sin conexión sigue guardado en el dispositivo."
            action={
              <Button variant="primary" icon="sync" onClick={() => window.location.reload()}>
                Recargar
              </Button>
            }
          />
        </Card>
      </div>
    );
  }
}
