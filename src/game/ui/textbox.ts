import { EventBus } from '../EventBus';
import type { TextboxPayload } from './textboxTypes';

export function queueTextbox(payload: TextboxPayload): void {
  EventBus.emit('ui:textbox:enqueue', payload);
}
