// React 19 moved the JSX namespace into `react` itself, so R3F ships its
// intrinsic-element types as a module augmentation rather than a global one.
// Importing the package for its side effect once makes <mesh>, <boxGeometry>
// and friends type-check everywhere, instead of in each file that happens to
// import something from @react-three/fiber.
import type {} from '@react-three/fiber';
