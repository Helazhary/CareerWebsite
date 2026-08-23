import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'transformer-cnn-study',
  kind: 'project',
  title: 'Transformer–CNN Comparative Study',
  // TODO(hussein): dates are ESTIMATED — the resume lists no project dates. Verify before publishing.
  start: '2025-02',
  end: '2025-06',
  district: 'lab',
  skin: 'lab',
  size: 'md',
  tags: ['PyTorch', 'Vision Transformer', 'Explainable AI', 'SHAP', 'Grad-CAM'],
  summary: 'CNNs vs. Vision Transformers vs. hybrids on a self-collected dataset, with explainability.',
  bullets: [
    'Built and evaluated CNN (EfficientNet), Vision Transformer, and hybrid ConvNeXt models for image classification on a self-collected campus dataset.',
    'Used transfer learning, extensive augmentation, and ensembling to push performance in a data-starved regime.',
    'Applied SHAP and Grad-CAM explainability to assess model behaviour and robustness, not just accuracy.',
    'Recorded a full video walkthrough of the methods and results.',
  ],
  links: {
    // TODO(hussein): paste the unlisted YouTube walkthrough URL here.
  },
  ambient: ['loss-curve-screen'],
};

export default entry;
