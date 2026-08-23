import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'nir-spectroscopy',
  kind: 'project',
  title: 'NIR Spectroscopy Prediction API',
  // TODO(hussein): dates are ESTIMATED — the resume lists no project dates. Verify before publishing.
  start: '2025-05',
  district: 'lab',
  skin: 'lab',
  status: 'in-progress',
  size: 'md',
  tags: ['Python', 'scikit-learn', 'Docker', 'AWS Lambda', 'GitHub Actions'],
  summary: 'A PLS regression model predicting moisture content from near-infrared spectra, served as an API.',
  bullets: [
    'Trained a PLS regression model predicting moisture content from near-infrared spectra across 201 wavelengths per scan.',
    'Grouped repeat scans of the same sample so no sample leaked between the training and test sets.',
    'Containerised with Docker and deployed as a REST API on AWS Lambda.',
    'Automated build and deployment through GitHub Actions.',
  ],
  ambient: ['loss-curve-screen'],
};

export default entry;
