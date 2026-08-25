'use client';

import type { Footprint } from '../layout';

/**
 * The ambient prop kit.
 *
 * `ambient` has been in the content schema since M0 and every entry declares
 * one or two, but nothing read the field — seventeen entries were asking for
 * props and getting bare forecourts. This is the registry that answers them.
 *
 * Same contract as the skin registry: props are looked up by the id written in
 * content, and the renderer never learns a project's name. An id with no prop
 * registered against it is ignored rather than throwing, so content can name a
 * prop before it exists (.claude/rules/world.md).
 *
 * Everything is positioned in the plot's local space — origin at ground centre,
 * +Z facing the road — so a prop is written once and works on any footprint.
 * Props stand on the forecourt between the building face and the kerb, which is
 * the only ground that is reliably clear: the layout guarantees a verge in front
 * of every building and guarantees nothing at all about the sides.
 */

const GLOW = {
  terminal: '#5cf2a8',
  lab: '#cfe9ff',
  window: '#ffd9a0',
  neon: '#ff5cc8',
  amber: '#ffb347',
} as const;

/** Emissive without a light. A few dozen point lights cost more than the scene. */
function Lit({
  color,
  intensity = 1.4,
}: {
  color: string;
  intensity?: number;
}): React.JSX.Element {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={intensity}
      toneMapped={false}
    />
  );
}

/** A screen on a post. The chassis three of these props share. */
function ScreenOnPost({
  color,
  width = 2.4,
  height = 1.6,
  post = 2.2,
  children,
}: {
  color: string;
  width?: number;
  height?: number;
  post?: number;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, post / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, post, 6]} />
        <meshStandardMaterial color="#3b414d" roughness={0.8} metalness={0.3} />
      </mesh>
      <mesh position={[0, post + height / 2, 0]} castShadow>
        <boxGeometry args={[width + 0.24, height + 0.24, 0.22]} />
        <meshStandardMaterial color="#22262e" roughness={0.85} />
      </mesh>
      <mesh position={[0, post + height / 2, 0.13]}>
        <planeGeometry args={[width, height]} />
        <Lit color={color} intensity={0.5} />
      </mesh>
      <group position={[0, post + height / 2, 0.15]}>{children}</group>
    </group>
  );
}

/**
 * Training loss, falling and flattening.
 *
 * Drawn as straight segments down a decay curve rather than as a texture: at
 * the distance this is read from, four segments and a real shape say "a model
 * trained" more clearly than any amount of resolution.
 */
function LossCurveScreen(): React.JSX.Element {
  const steps = 7;
  const points = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return { x: -1.0 + t * 2.0, y: 0.62 - (1 - Math.exp(-3.1 * t)) * 1.12 };
  });

  return (
    <ScreenOnPost color={GLOW.lab}>
      {points.slice(0, -1).map((from, i) => {
        const to = points[i + 1];
        if (to === undefined) return null;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return (
          <mesh
            key={from.x}
            position={[(from.x + to.x) / 2, (from.y + to.y) / 2, 0.01]}
            rotation={[0, 0, Math.atan2(dy, dx)]}
          >
            <planeGeometry args={[Math.hypot(dx, dy), 0.09]} />
            <Lit color={GLOW.terminal} intensity={2.2} />
          </mesh>
        );
      })}
    </ScreenOnPost>
  );
}

/** Lines of output, ragged like real output rather than a neat block. */
function TerminalScreen(): React.JSX.Element {
  const lines = [0.92, 0.55, 0.78, 0.34, 0.66, 0.22];
  return (
    <ScreenOnPost color="#0d1a14">
      {lines.map((width, i) => (
        <mesh key={width} position={[-1.05 + (width * 2.1) / 2, 0.58 - i * 0.22, 0.01]}>
          <planeGeometry args={[width * 2.1, 0.1]} />
          <Lit color={GLOW.terminal} intensity={2} />
        </mesh>
      ))}
    </ScreenOnPost>
  );
}

/** A trace across a small instrument screen, and the box it lives in. */
function Oscilloscope(): React.JSX.Element {
  const steps = 24;
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.5, 1.1, 0.9]} />
        <meshStandardMaterial color="#5b5f68" roughness={0.7} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.62, 0.46]}>
        <planeGeometry args={[0.94, 0.66]} />
        <Lit color="#0e2318" intensity={0.5} />
      </mesh>
      {Array.from({ length: steps }, (_, i) => {
        const t = i / (steps - 1);
        return (
          <mesh key={t} position={[-0.42 + t * 0.84, 0.62 + Math.sin(t * Math.PI * 3) * 0.2, 0.48]}>
            <planeGeometry args={[0.05, 0.05]} />
            <Lit color={GLOW.terminal} intensity={2.4} />
          </mesh>
        );
      })}
      {/* Knobs. Two dark discs are enough to say "instrument" at this size. */}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.2, 0.46]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.08, 8]} />
          <meshStandardMaterial color="#22262e" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.6, 0.1, 1.0]} />
        <meshStandardMaterial color="#2b2f37" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Upright cabinet, raked screen, marquee over the top. */
function ArcadeCabinet(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[1.5, 2.7, 1.1]} />
        <meshStandardMaterial color="#2a2338" roughness={0.75} />
      </mesh>
      {/* Screen, raked back the way a cabinet's is. */}
      <mesh position={[0, 1.85, 0.5]} rotation={[-0.32, 0, 0]}>
        <planeGeometry args={[1.15, 0.9]} />
        <Lit color={GLOW.neon} intensity={1.3} />
      </mesh>
      {/* Marquee: a dark housing with a lit face, not a lit box. Emissive on
          every side it reads as a flat slab of colour from anywhere above eye
          level, which from a chase camera looking down is most of the time. */}
      <mesh position={[0, 2.82, 0.12]} castShadow>
        <boxGeometry args={[1.56, 0.42, 1.16]} />
        <meshStandardMaterial color="#1b1726" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.82, 0.71]}>
        <planeGeometry args={[1.42, 0.32]} />
        <Lit color={GLOW.neon} intensity={1.5} />
      </mesh>
      {/* Control panel and two buttons. */}
      <mesh position={[0, 1.24, 0.62]} rotation={[-0.9, 0, 0]} castShadow>
        <boxGeometry args={[1.44, 0.6, 0.12]} />
        <meshStandardMaterial color="#1b1726" roughness={0.8} />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 1.42, 0.72]}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <Lit color={GLOW.amber} intensity={1.6} />
        </mesh>
      ))}
    </group>
  );
}

/** A board on two legs with things pinned to it. */
function NoticeBoard(): React.JSX.Element {
  const sheets = [
    { x: -0.62, y: 0.28, w: 0.5, h: 0.62 },
    { x: 0.02, y: 0.1, w: 0.56, h: 0.44 },
    { x: 0.64, y: 0.34, w: 0.46, h: 0.56 },
    { x: -0.2, y: -0.44, w: 0.62, h: 0.4 },
  ];
  return (
    <group>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.7, 0]} castShadow>
          <boxGeometry args={[0.14, 1.4, 0.14]} />
          <meshStandardMaterial color="#4a4238" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[2.3, 1.6, 0.14]} />
        <meshStandardMaterial color="#3d342a" roughness={1} />
      </mesh>
      {sheets.map((sheet) => (
        <mesh key={sheet.x} position={[sheet.x, 1.85 + sheet.y, 0.09]}>
          <planeGeometry args={[sheet.w, sheet.h]} />
          <meshStandardMaterial color="#d8d2c4" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** A rolling tool chest, drawers and all. */
function Toolbox(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[1.7, 1.35, 0.9]} />
        <meshStandardMaterial color="#8e2b25" roughness={0.55} metalness={0.35} />
      </mesh>
      {/* Drawer fronts. The whole read of this prop is the horizontal lines. */}
      {[0.35, 0.72, 1.09].map((y) => (
        <mesh key={y} position={[0, y, 0.46]}>
          <boxGeometry args={[1.5, 0.26, 0.06]} />
          <meshStandardMaterial color="#6f211c" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Top chest, narrower than the base the way they always are. */}
      <mesh position={[0, 1.68, 0]} castShadow>
        <boxGeometry args={[1.5, 0.55, 0.8]} />
        <meshStandardMaterial color="#8e2b25" roughness={0.55} metalness={0.35} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.12, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.1, 8]} />
          <meshStandardMaterial color="#15181f" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Two-post lift, arms out, raised. */
function CarLift(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[3.6, 0.2, 2.4]} />
        <meshStandardMaterial color="#2b2f37" roughness={0.95} />
      </mesh>
      {[-1.5, 1.5].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.9, 0]} castShadow>
            <boxGeometry args={[0.42, 3.6, 0.42]} />
            <meshStandardMaterial color="#c8a72e" roughness={0.6} metalness={0.4} />
          </mesh>
          {/* Arms, at the height a lift actually sits when something is on it. */}
          {[-0.7, 0.7].map((z) => (
            <mesh key={z} position={[x + (x > 0 ? -0.6 : 0.6), 2.3, z]} castShadow>
              <boxGeometry args={[1.3, 0.2, 0.24]} />
              <meshStandardMaterial color="#c8a72e" roughness={0.6} metalness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Overhead beam, which is what makes it read as a lift and not a gate. */}
      <mesh position={[0, 3.8, 0]} castShadow>
        <boxGeometry args={[3.4, 0.3, 0.3]} />
        <meshStandardMaterial color="#c8a72e" roughness={0.6} metalness={0.4} />
      </mesh>
    </group>
  );
}

/** Jointed arm on a pedestal, folded the way an idle one sits. */
function RobotArm(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.75, 0.56, 10]} />
        <meshStandardMaterial color="#3b414d" roughness={0.7} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.44, 0.8, 10]} />
        <meshStandardMaterial color="#d0761f" roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Upper arm, raked back; forearm, raked forward. A straight arm reads as
          a post, and a post is not a robot. */}
      <mesh position={[0, 1.85, -0.28]} rotation={[0.38, 0, 0]} castShadow>
        <boxGeometry args={[0.42, 1.7, 0.42]} />
        <meshStandardMaterial color="#d0761f" roughness={0.55} metalness={0.3} />
      </mesh>
      <mesh position={[0, 2.72, 0.42]} rotation={[-0.78, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 1.5, 0.34]} />
        <meshStandardMaterial color="#d0761f" roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Gripper. */}
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 3.2, 0.92]} rotation={[-0.78, 0, 0]} castShadow>
          <boxGeometry args={[0.1, 0.44, 0.12]} />
          <meshStandardMaterial color="#22262e" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Small biped, mid-stride so it reads as walking rather than standing. */
function WalkingRobot(): React.JSX.Element {
  return (
    <group>
      {/* Legs, one forward one back. */}
      {[
        { x: -0.24, z: 0.22, tilt: 0.3 },
        { x: 0.24, z: -0.22, tilt: -0.3 },
      ].map((leg) => (
        <mesh key={leg.x} position={[leg.x, 0.55, leg.z]} rotation={[leg.tilt, 0, 0]} castShadow>
          <boxGeometry args={[0.26, 1.1, 0.26]} />
          <meshStandardMaterial color="#4b5260" roughness={0.7} metalness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.86, 0.96, 0.6]} />
        <meshStandardMaterial color="#8d97a6" roughness={0.6} metalness={0.35} />
      </mesh>
      {/* Arms. */}
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 1.46, 0]} rotation={[x > 0 ? 0.4 : -0.4, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.86, 0.2]} />
          <meshStandardMaterial color="#4b5260" roughness={0.7} metalness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 2.22, 0]} castShadow>
        <boxGeometry args={[0.6, 0.5, 0.54]} />
        <meshStandardMaterial color="#8d97a6" roughness={0.6} metalness={0.35} />
      </mesh>
      {/* Visor. The one lit thing, so you can tell which way it is facing. */}
      <mesh position={[0, 2.26, 0.28]}>
        <planeGeometry args={[0.42, 0.16]} />
        <Lit color={GLOW.lab} intensity={2} />
      </mesh>
    </group>
  );
}

/** Keypad on a stalk, beside a door that is not there. */
function DoorLock(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 1.4, 6]} />
        <meshStandardMaterial color="#3b414d" roughness={0.8} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[0.7, 0.95, 0.18]} />
        <meshStandardMaterial color="#22262e" roughness={0.75} />
      </mesh>
      {/* Keypad. Three rows of three is unmistakably a keypad. */}
      {[0, 1, 2].flatMap((row) =>
        [-1, 0, 1].map((col) => (
          <mesh key={`${row}:${col}`} position={[col * 0.19, 1.82 - row * 0.19, 0.1]}>
            <planeGeometry args={[0.13, 0.13]} />
            <Lit color={GLOW.window} intensity={0.9} />
          </mesh>
        )),
      )}
      {/* Status light: locked. */}
      <mesh position={[0, 1.26, 0.1]}>
        <planeGeometry args={[0.16, 0.1]} />
        <Lit color="#4ade80" intensity={2.2} />
      </mesh>
    </group>
  );
}

/** Ladder tray on stanchions, cables in it. */
function CableTray(): React.JSX.Element {
  const rungs = 9;
  const length = 5.4;
  return (
    <group>
      {[-length / 2 + 0.4, length / 2 - 0.4].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} castShadow>
          <boxGeometry args={[0.16, 1.7, 0.16]} />
          <meshStandardMaterial color="#3b414d" roughness={0.8} metalness={0.35} />
        </mesh>
      ))}
      {/* Side rails. */}
      {[-0.34, 0.34].map((z) => (
        <mesh key={z} position={[0, 1.74, z]} castShadow>
          <boxGeometry args={[length, 0.12, 0.1]} />
          <meshStandardMaterial color="#6b7280" roughness={0.7} metalness={0.45} />
        </mesh>
      ))}
      {Array.from({ length: rungs }, (_, i) => (
        <mesh key={i} position={[-length / 2 + (i + 0.5) * (length / rungs), 1.72, 0]}>
          <boxGeometry args={[0.09, 0.05, 0.72]} />
          <meshStandardMaterial color="#6b7280" roughness={0.7} metalness={0.45} />
        </mesh>
      ))}
      {/* The cables. Two runs, slightly different colours, sitting in the tray. */}
      {[
        { z: -0.16, color: '#2f3846' },
        { z: 0.14, color: '#4a3324' },
      ].map((cable) => (
        <mesh key={cable.z} position={[0, 1.82, cable.z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.09, length, 6]} />
          <meshStandardMaterial color={cable.color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Two cars in a bay. Boxes, but car-proportioned boxes with lit glass. */
function ParkedCars(): React.JSX.Element {
  const cars = [
    { x: -1.6, color: '#3f4753' },
    { x: 1.6, color: '#54413f' },
  ];
  return (
    <group>
      {cars.map((car) => (
        <group key={car.x} position={[car.x, 0, 0]}>
          <mesh position={[0, 0.62, 0]} castShadow>
            <boxGeometry args={[2.0, 0.66, 4.4]} />
            <meshStandardMaterial color={car.color} roughness={0.45} metalness={0.45} />
          </mesh>
          <mesh position={[0, 1.16, -0.2]} castShadow>
            <boxGeometry args={[1.76, 0.5, 2.1]} />
            <meshStandardMaterial color="#1a2130" roughness={0.2} metalness={0.3} />
          </mesh>
          {[-0.78, 0.78].flatMap((x) =>
            [-1.4, 1.4].map((z) => (
              <mesh
                key={`${x}:${z}`}
                position={[x, 0.34, z]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
              >
                <cylinderGeometry args={[0.34, 0.34, 0.2, 10]} />
                <meshStandardMaterial color="#15181f" roughness={1} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

/**
 * A stand of trees.
 *
 * The global scatter already puts trees across open ground, but it keeps clear
 * of plots — so a campus that asks for trees has none anywhere near it. These
 * are the ones standing on the grounds, and they match the scatter's shapes so
 * the two read as the same planting.
 */
function Trees(): React.JSX.Element {
  const stand = [
    { x: -2.4, z: 0.4, scale: 1.0 },
    { x: 1.1, z: -0.8, scale: 0.78 },
    { x: 2.8, z: 0.9, scale: 1.14 },
  ];
  return (
    <group>
      {stand.map((tree) => (
        <group key={tree.x} position={[tree.x, 0, tree.z]} scale={tree.scale}>
          <mesh position={[0, 2.1, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.46, 4.2, 6]} />
            <meshStandardMaterial color="#453728" roughness={1} />
          </mesh>
          <mesh position={[0, 5.4, 0]} castShadow>
            <icosahedronGeometry args={[3.4, 0]} />
            <meshStandardMaterial color="#436b4c" roughness={0.95} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Lying snow.
 *
 * The detour already paints its roads and verges white, which says "somewhere
 * else" while you are driving on it — but the ground beside the buildings was
 * still summer grass, so the buildings looked pasted onto the wrong season.
 * Drifts rather than a flat sheet: a plain white rectangle reads as a hole.
 */
function Snow(): React.JSX.Element {
  const drifts = [
    { x: -3.2, z: 0.6, rx: 3.4, rz: 2.0 },
    { x: 0.4, z: -0.9, rx: 4.2, rz: 2.6 },
    { x: 3.6, z: 1.1, rx: 3.0, rz: 1.8 },
  ];
  return (
    <group>
      {drifts.map((drift) => (
        <mesh
          key={drift.x}
          position={[drift.x, 0.06, drift.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[drift.rx, drift.rz, 1]}
          receiveShadow
        >
          <circleGeometry args={[1, 12]} />
          <meshStandardMaterial color="#c9d2de" roughness={1} />
        </mesh>
      ))}
      {/* A couple of heaped banks, so it has thickness from a low camera. */}
      {[
        { x: -1.8, z: 1.4 },
        { x: 2.6, z: -0.6 },
      ].map((bank) => (
        <mesh key={bank.x} position={[bank.x, 0.1, bank.z]} scale={[1.9, 0.42, 1.4]} castShadow>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#e6ecf4" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Windows with the lights on.
 *
 * Unlike the rest of the kit this one belongs on the building, not the
 * forecourt, so it is flagged `onFacade` below and placed against the front
 * face instead of out on the ground. The skins draw lit *bands*, which read as
 * a lit floor; this reads as a lit office, with some of them dark, because a
 * building where every window is on reads as a render.
 */
function LitWindows({ footprint }: { footprint: Footprint }): React.JSX.Element {
  // Deliberately coarse. A pane every four metres gives a large building
  // forty-odd separate meshes, and the kit's rule is that anything appearing a
  // few dozen times over should not be forty draw calls per building — but it
  // also just reads better: at the distance these are seen from, small panes
  // blur into a stripe and stop looking like windows at all.
  const columns = Math.max(3, Math.round(footprint.width / 6));
  const rows = Math.max(2, Math.round(footprint.height / 6));
  const cells: { x: number; y: number; on: boolean }[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      // Deterministic, and deliberately not a neat pattern.
      const on = ((row * 7 + column * 3 + ((row * column) % 5)) % 11) % 3 !== 0;
      cells.push({
        x: (column - (columns - 1) / 2) * (footprint.width / columns),
        y: footprint.height * 0.28 + row * (footprint.height * 0.46) / rows,
        on,
      });
    }
  }

  const paneWidth = (footprint.width / columns) * 0.52;
  const paneHeight = ((footprint.height * 0.46) / rows) * 0.5;

  return (
    <group>
      {cells.map((cell) => (
        <mesh key={`${cell.x}:${cell.y}`} position={[cell.x, cell.y, 0.06]}>
          <planeGeometry args={[paneWidth, paneHeight]} />
          {cell.on ? (
            <Lit color={GLOW.window} intensity={1.1} />
          ) : (
            <meshStandardMaterial color="#1d2029" roughness={0.4} metalness={0.2} />
          )}
        </mesh>
      ))}
    </group>
  );
}

/**
 * How much ground a prop occupies: across the frontage, and out towards the
 * road. Measured after `scale`.
 *
 * A bounding circle was the obvious choice and is the wrong one. Two parked
 * cars are four times longer than they are wide, and a circle around them
 * reserves a radius big enough to reach the kerb — so the prop either gets
 * shrunk to nothing or put through the road. Which way a thing is long matters
 * here, because only one of the two directions is constrained.
 */
interface Extent {
  readonly width: number;
  readonly depth: number;
}

interface AmbientProp {
  /** On the front wall rather than out on the forecourt. */
  readonly onFacade?: boolean;
  /** Multiplier on the prop's own geometry. See `PROP_SCALE`. */
  readonly scale: number;
  /** Ground extent *after* scaling. Zero for facade props. */
  readonly extent: Extent;
  readonly render: (footprint: Footprint) => React.JSX.Element;
}

/**
 * Props are modelled at life size and then scaled up, for exactly the reason
 * `Car.tsx` scales the car: the world is measured in metres, and a 2 m robot
 * beside a 22 m building is a speck. Anything that shares a scale with the car
 * uses the car's own 2.2 so the two agree.
 */
const PROP_SCALE = 2.2;

/** Clear ground between the building face and the nearest prop. */
const FORECOURT_GAP = 1.4;

const PROPS: Record<string, AmbientProp> = {
  'arcade-cabinet': {
    scale: PROP_SCALE,
    extent: { width: 1.5 * PROP_SCALE, depth: 1.4 * PROP_SCALE },
    render: () => <ArcadeCabinet />,
  },
  'cable-tray': {
    scale: 1.5,
    extent: { width: 5.4 * 1.5, depth: 0.8 * 1.5 },
    render: () => <CableTray />,
  },
  'car-lift': {
    scale: 1.6,
    extent: { width: 3.6 * 1.6, depth: 2.4 * 1.6 },
    render: () => <CarLift />,
  },
  'door-lock': {
    scale: PROP_SCALE,
    extent: { width: 0.7 * PROP_SCALE, depth: 0.4 * PROP_SCALE },
    render: () => <DoorLock />,
  },
  'lit-windows': {
    onFacade: true,
    scale: 1,
    extent: { width: 0, depth: 0 },
    render: (footprint) => <LitWindows footprint={footprint} />,
  },
  'loss-curve-screen': {
    scale: 1.8,
    extent: { width: 2.64 * 1.8, depth: 0.4 * 1.8 },
    render: () => <LossCurveScreen />,
  },
  'notice-board': {
    scale: 2,
    extent: { width: 2.3 * 2, depth: 0.4 * 2 },
    render: () => <NoticeBoard />,
  },
  oscilloscope: {
    scale: 2.4,
    extent: { width: 1.6 * 2.4, depth: 1.0 * 2.4 },
    render: () => <Oscilloscope />,
  },
  'parked-cars': {
    // Side-on to the road, the way a car in a bay in front of an office is.
    // Nose-in they would be twice as deep and could not fit a small plot.
    scale: PROP_SCALE,
    extent: { width: 4.6 * PROP_SCALE, depth: 2.0 * PROP_SCALE },
    render: () => (
      <group rotation={[0, Math.PI / 2, 0]}>
        <ParkedCars />
      </group>
    ),
  },
  'robot-arm': {
    scale: PROP_SCALE,
    extent: { width: 1.5 * PROP_SCALE, depth: 1.5 * PROP_SCALE },
    render: () => <RobotArm />,
  },
  snow: {
    scale: 1.6,
    extent: { width: 11 * 1.6, depth: 5 * 1.6 },
    render: () => <Snow />,
  },
  'terminal-screen': {
    scale: 1.8,
    extent: { width: 2.64 * 1.8, depth: 0.4 * 1.8 },
    render: () => <TerminalScreen />,
  },
  toolbox: {
    scale: PROP_SCALE,
    extent: { width: 1.7 * PROP_SCALE, depth: 0.9 * PROP_SCALE },
    render: () => <Toolbox />,
  },
  trees: {
    scale: 1,
    extent: { width: 12, depth: 8 },
    render: () => <Trees />,
  },
  'walking-robot': {
    scale: PROP_SCALE,
    extent: { width: 1.2 * PROP_SCALE, depth: 1.0 * PROP_SCALE },
    render: () => <WalkingRobot />,
  },
};

/** Ids with nothing registered against them. Exported so a test can name them. */
export function unknownAmbientIds(ids: readonly string[]): string[] {
  return ids.filter((id) => PROPS[id] === undefined);
}

/**
 * How far out from the plot centre a prop's far edge reaches.
 *
 * The layout guarantees `verge + radius` of clear ground between a plot centre
 * and the kerb, and nothing at all beside a building — so this is the number
 * that has to stay inside that, and the test checks it against the real layout
 * constants rather than against a copied-out figure.
 */
export function forecourtReach(footprint: Footprint, id: string): number {
  const prop = PROPS[id];
  if (prop === undefined || prop.onFacade === true) return 0;
  return footprint.depth / 2 + prop.extent.depth + FORECOURT_GAP;
}

/** Every id this kit answers to. */
export function registeredAmbientIds(): string[] {
  return Object.keys(PROPS);
}

/**
 * Place a plot's ambient props.
 *
 * Forecourt props stand in a row across the building's frontage, each in its
 * own slice of it, pushed out far enough to clear the wall. They are kept in
 * towards the middle rather than spread to the corners: a building 36 m wide
 * with one small prop at each far edge reads as two pieces of litter, not as a
 * forecourt.
 */
export function renderAmbient(
  ids: readonly string[],
  footprint: Footprint,
): React.JSX.Element | null {
  const known = ids
    .map((id) => ({ id, prop: PROPS[id] }))
    .filter((item): item is { id: string; prop: AmbientProp } => item.prop !== undefined);
  if (known.length === 0) return null;

  const forecourt = known.filter((item) => item.prop.onFacade !== true);
  const needed = forecourt.reduce((sum, item) => sum + item.prop.extent.width, 0);
  // Wide enough to hold everything with a little air, but never the full
  // frontage of a large building.
  const span = Math.min(Math.max(needed * 1.25, needed), Math.max(footprint.width - 3, needed));

  let cursor = -span / 2;

  return (
    <group>
      {known.map(({ id, prop }, index) => {
        if (prop.onFacade === true) {
          return (
            <group key={`${id}:${index}`} position={[0, 0, footprint.depth / 2]}>
              {prop.render(footprint)}
            </group>
          );
        }
        const slice = needed === 0 ? span : (prop.extent.width * span) / needed;
        const x = cursor + slice / 2;
        cursor += slice;
        return (
          <group
            key={`${id}:${index}`}
            position={[x, 0, footprint.depth / 2 + prop.extent.depth / 2 + FORECOURT_GAP]}
            scale={prop.scale}
          >
            {prop.render(footprint)}
          </group>
        );
      })}
    </group>
  );
}
