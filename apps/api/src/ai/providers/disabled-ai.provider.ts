import {
  AiProvider,
  AiProviderCompletion,
  AiProviderUnavailableError,
} from './ai.provider';

export class DisabledAiProvider implements AiProvider {
  readonly name = 'DISABLED';
  readonly model = 'disabled';

  complete(): Promise<AiProviderCompletion> {
    return Promise.reject(
      new AiProviderUnavailableError('AI assistance is not configured.'),
    );
  }
}
