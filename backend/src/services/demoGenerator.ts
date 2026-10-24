import { randomUUID } from 'node:crypto';
import { HttpError } from '../errors.js';

export type GeneratedStep = {
  id: string;
  title: string;
  instructions: string;
  expected: string;
  verification: string;
  safety: string;
  feedback: string;
};

export type GenerationResult = {
  steps: GeneratedStep[];
  provenance: 'demo-template';
  simulated: true;
  humanReviewRequired: true;
};

export interface StepGenerator {
  generate(input: { title: string; description: string; mode: 'demo' }): Promise<GenerationResult>;
}

export class SampleStepGenerator implements StepGenerator {
  async generate(input: { title: string; description: string; mode: 'demo' }): Promise<GenerationResult> {
    if (input.mode !== 'demo' || !/paper\s+bridge/i.test(`${input.title} ${input.description}`)) {
      throw new HttpError(422, 'DEMO_TEMPLATE_UNAVAILABLE', 'The sample generator only supports the paper-bridge example. No media was analysed.');
    }

    return {
      provenance: 'demo-template',
      simulated: true,
      humanReviewRequired: true,
      steps: [
        { id: randomUUID(), title: 'Set up the span', instructions: 'Place two sturdy books parallel with a small gap between them.', expected: 'The books form a steady, even gap.', verification: 'Check that the book edges are level.', safety: '', feedback: 'Move the books closer and check that neither rocks.' },
        { id: randomUUID(), title: 'Fold the support', instructions: 'Fold one sheet of paper back and forth into even accordion sections.', expected: 'The folded paper stands in repeating ridges.', verification: 'Compare the ridge heights along the edge.', safety: '', feedback: 'Refold with wider, more even sections.' },
        { id: randomUUID(), title: 'Place the bridge deck', instructions: 'Rest a second sheet across the folded support and center it over the gap.', expected: 'The top sheet reaches both book edges.', verification: 'Check that the support is centered under the deck.', safety: '', feedback: 'Center the support before testing again.' },
        { id: randomUUID(), title: 'Test gently', instructions: 'Add a few lightweight coins one at a time near the center. Stop if the bridge slips or bends sharply.', expected: 'The bridge spans the gap while supporting a few coins.', verification: 'Observe where the paper bends, then remove the coins.', safety: 'Keep the test low over a clear surface and use only lightweight objects.', feedback: 'Remove the coins and check the support alignment.' },
      ],
    };
  }
}