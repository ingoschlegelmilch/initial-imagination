export type TextboxMode = 'dialogue' | 'system' | 'combat' | 'shop';

export interface TextboxChoice {
  label: string;
  value?: string; // defaults to label if omitted
}

export interface TextboxPayload {
  text: string | string[];   // single page or multiple pages
  speaker?: string;
  mode?: TextboxMode;        // defaults to 'dialogue'
  choices?: TextboxChoice[];
  choiceEvent?: string;      // EventBus event emitted with chosen value
  completeEvent?: string;    // EventBus event emitted when entry is fully done
}
