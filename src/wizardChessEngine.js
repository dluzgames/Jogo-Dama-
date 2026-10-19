import * as THREE_NS from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** @type {any} */
const THREE = THREE_NS;
const SkeletonUtils = { clone: cloneSkeleton };

export function initWizardChess() {
    // =========================================================================
    // Constants & Board Coordinates (Tabuleiro Oficial 8x8 — Damas Brasileiras)
    // =========================================================================
    const PIECE_TYPES = ['pawn', 'queen'];
    const PIECE_VALUES = { pawn: 100, queen: 350 };
    const BOARD_SQ_SIZE = 0.34;
    const BOARD_SURFACE_Y = 0.775;

    function boardToWorld(r, c) {
      return new THREE.Vector3(
        (c - 3.5) * BOARD_SQ_SIZE,
        BOARD_SURFACE_Y,
        (r - 3.5) * BOARD_SQ_SIZE
      );
    }

    function easeInOutCubic(x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function easeOutCubic(x) {
      return 1 - Math.pow(1 - x, 3);
    }

    // =========================================================================
    // Scene, Camera, Renderer, and Cathedral Lighting
    // =========================================================================
    const container = document.getElementById('canvas-container') || document.getElementById('viewport-container');
    if (container) container.innerHTML = '';
    const isAutomatedTest = Boolean(
      navigator.webdriver || new URLSearchParams(window.location.search).get('autotest') === '1'
    );
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: isAutomatedTest
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);
    scene.fog = new THREE.FogExp2(0x080b14, 0.015);

    // Self-contained Cathedral PMREM Environment (inspired by three-gpu-pathtracer & realism-effects)
    function createCathedralPMREMEnvironment(glRenderer) {
      const pmremGen = new THREE.PMREMGenerator(glRenderer);
      pmremGen.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x161412);
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      const addPanel = (colorHex, intensity, pos, scl) => {
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(colorHex).multiplyScalar(intensity)
        });
        const m = new THREE.Mesh(boxGeo, mat);
        m.position.fromArray(pos);
        m.scale.fromArray(scl);
        envScene.add(m);
      };
      // Upper Gothic clerestory & Rose Window light panels
      addPanel(0xdce6f7, 2.4, [0, 9.5, -12.0], [10.0, 2.0, 1.5]);
      addPanel(0xffe0b5, 2.2, [0, 9.5, 12.0], [10.0, 2.0, 1.5]);
      addPanel(0xd4deee, 1.8, [-9.0, 6.5, 0.0], [1.2, 4.5, 16.0]);
      addPanel(0xd4deee, 1.8, [9.0, 6.5, 0.0], [1.2, 4.5, 16.0]);
      // Warm twin fire cauldron & limestone floor bounce panels
      addPanel(0xff9438, 3.2, [-4.5, 1.6, 0.0], [2.2, 2.2, 4.0]);
      addPanel(0xff9438, 3.2, [4.5, 1.6, 0.0], [2.2, 2.2, 4.0]);
      addPanel(0x6e5c49, 0.9, [0, -4.0, 0.0], [16.0, 1.0, 24.0]);
      const envTex = pmremGen.fromScene(envScene, 0.04).texture;
      boxGeo.dispose();
      pmremGen.dispose();
      return envTex;
    }

    scene.environment = createCathedralPMREMEnvironment(renderer);
    if ('environmentIntensity' in scene) {
      scene.environmentIntensity = 0.24;
    }

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.22, 65);
    camera.position.set(0, 2.22, 2.72);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.16;
    orbitControls.maxPolarAngle = Math.PI * 0.88;
    orbitControls.minPolarAngle = 0.05;
    orbitControls.minDistance = 0.95;
    orbitControls.maxDistance = 36.0;
    orbitControls.target.set(0, 0.85, -0.15);
    orbitControls.update();

    // =========================================================================
    // Feature 5: Hold Shift + Mouse Drag (Left=Rotate, Right=Pan) Axis Lock (X or Y)
    // =========================================================================
    let isShiftKeyDown = false;
    const shiftDragState = {
      active: false,
      startX: 0,
      startY: 0,
      lockedAxis: null // 'x' | 'y' | null
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') isShiftKeyDown = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        isShiftKeyDown = false;
        shiftDragState.lockedAxis = null;
      }
    });

    // Capture pointerdown BEFORE OrbitControls so Shift+LeftClick stays ROTATE (instead of OrbitControls' default Shift->PAN swap)
    renderer.domElement.addEventListener(
      'pointerdown',
      (e) => {
        shiftDragState.active = true;
        shiftDragState.startX = e.clientX;
        shiftDragState.startY = e.clientY;
        shiftDragState.lockedAxis = null;
        if (e.shiftKey) {
          isShiftKeyDown = true;
          if (e.button === 0) {
            try {
              Object.defineProperty(e, 'shiftKey', {
                get: () => false,
                configurable: true
              });
            } catch (err) {}
          }
        }
      },
      { capture: true }
    );

    window.addEventListener('pointerup', () => {
      shiftDragState.active = false;
      shiftDragState.lockedAxis = null;
    });

    const origHandleMouseMoveRotate = orbitControls._handleMouseMoveRotate.bind(orbitControls);
    orbitControls._handleMouseMoveRotate = function (event) {
      if (event.shiftKey || isShiftKeyDown) {
        const dx = Math.abs(event.clientX - shiftDragState.startX);
        const dy = Math.abs(event.clientY - shiftDragState.startY);
        if (!shiftDragState.lockedAxis && (dx > 2 || dy > 2)) {
          shiftDragState.lockedAxis = dx >= dy ? 'x' : 'y';
        }
        if (shiftDragState.lockedAxis === 'x') {
          return origHandleMouseMoveRotate({
            clientX: event.clientX,
            clientY: this._rotateStart.y
          });
        } else if (shiftDragState.lockedAxis === 'y') {
          return origHandleMouseMoveRotate({
            clientX: this._rotateStart.x,
            clientY: event.clientY
          });
        }
      } else {
        shiftDragState.lockedAxis = null;
      }
      return origHandleMouseMoveRotate(event);
    };

    const origHandleMouseMovePan = orbitControls._handleMouseMovePan.bind(orbitControls);
    orbitControls._handleMouseMovePan = function (event) {
      if (event.shiftKey || isShiftKeyDown) {
        const dx = Math.abs(event.clientX - shiftDragState.startX);
        const dy = Math.abs(event.clientY - shiftDragState.startY);
        if (!shiftDragState.lockedAxis && (dx > 2 || dy > 2)) {
          shiftDragState.lockedAxis = dx >= dy ? 'x' : 'y';
        }
        if (shiftDragState.lockedAxis === 'x') {
          return origHandleMouseMovePan({
            clientX: event.clientX,
            clientY: this._panStart.y
          });
        } else if (shiftDragState.lockedAxis === 'y') {
          return origHandleMouseMovePan({
            clientX: this._panStart.x,
            clientY: event.clientY
          });
        }
      } else {
        shiftDragState.lockedAxis = null;
      }
      return origHandleMouseMovePan(event);
    };

    // Dramatic Chiaroscuro Cathedral & Board Lighting (restoring original-example 3D stone relief & warm firelight contrast)
    const hemiLight = new THREE.HemisphereLight(0xd8ccb8, 0x261d14, 0.62);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff0d6, 2.55);
    keyLight.position.set(3.8, 8.5, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 22.0;
    const d = 3.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Subtle directional rim/fill (kept low so opposing directional lights never cancel normal-map mortar shadows)
    const rimLight = new THREE.DirectionalLight(0xd8cbb8, 0.72);
    rimLight.position.set(-4.5, 6.0, -6.5);
    scene.add(rimLight);

    const southFillLight = new THREE.DirectionalLight(0xffe4c0, 0.52);
    southFillLight.position.set(4.2, 5.8, 7.5);
    scene.add(southFillLight);

    // Twin Flickering Brazier Point Lights (centered at x = +/-3.65, z = 0.00; flanking column bounce is evaluated in shader)
    const brazierCoords = [
      { pos: [-3.65, 1.08, 0.00], baseIntensity: 4.35, dist: 18.0 },
      { pos: [3.65, 1.08, 0.00], baseIntensity: 4.35, dist: 18.0 }
    ];
    const brazierLights = [];
    for (const cfg of brazierCoords) {
      const pLight = new THREE.PointLight(0xff8e32, cfg.baseIntensity, cfg.dist, 1.40);
      pLight.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      pLight.userData.baseIntensity = cfg.baseIntensity;
      scene.add(pLight);
      brazierLights.push(pLight);
    }

    // Realistic Gaseous GLSL Brazier Flames & Soft Warm Firelight Glow (zero bouncing shapes)
    const brazierFireUniforms = [];
    const brazierGlowSprites = [];

    function createSoftGlowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(128, 128, 2, 128, 128, 128);
      grad.addColorStop(0.0, 'rgba(255, 226, 155, 0.88)');
      grad.addColorStop(0.18, 'rgba(255, 154, 52, 0.50)');
      grad.addColorStop(0.45, 'rgba(255, 92, 16, 0.18)');
      grad.addColorStop(0.75, 'rgba(210, 48, 4, 0.04)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // Strip the 14 tiny static icosphere spark balls baked above Opt8_Brazier_Flame_Mid (y > 1.26, height < 0.10)
    // while preserving 100% of the sculpted flame tongues (which start at y = 0.59..0.61)
    function stripIcosphereSparksFromFlameGeometry(geometry) {
      if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
      const pos = geometry.attributes.position;
      if (geometry.index) {
        const idx = geometry.index.array;
        for (let i = 0; i < idx.length; i += 3) {
          const i0 = idx[i];
          const i1 = idx[i + 1];
          const i2 = idx[i + 2];
          const y0 = pos.getY(i0);
          const y1 = pos.getY(i1);
          const y2 = pos.getY(i2);
          const minY = Math.min(y0, y1, y2);
          if (minY > 1.25) {
            idx[i] = 0;
            idx[i + 1] = 0;
            idx[i + 2] = 0;
          }
        }
        geometry.index.needsUpdate = true;
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          const y0 = pos.getY(i);
          const y1 = pos.getY(i + 1);
          const y2 = pos.getY(i + 2);
          if (Math.min(y0, y1, y2) > 1.25) {
            pos.setXYZ(i, 0, 0, 0);
            pos.setXYZ(i + 1, 0, 0, 0);
            pos.setXYZ(i + 2, 0, 0, 0);
          }
        }
        pos.needsUpdate = true;
      }
    }

    // =========================================================================
    // Cathedral Room Boundary Clamping (Floor, Ceiling, Side & End Walls)
    // & Solid Cylindrical Column Collision / Circumferential Sliding Solver
    // =========================================================================
    const CATHEDRAL_BOUNDS = {
      minX: -6.65,
      maxX: 6.65,
      minY: 0.34,
      maxY: 8.85,
      minZ: -18.10,
      maxZ: 18.10
    };

    // 12 freestanding columns spread wider across the nave; the 4 columns closest to the chessboard (z = +/-2.20)
    // have been removed to create a grand 13.70m open Atrium around the altar and centered fire braziers
    const CATHEDRAL_COLUMN_ROWS = [
      { z: -16.65, xAbs: 4.25 },
      { z: -11.85, xAbs: 4.25 },
      { z: -6.85,  xAbs: 4.65 },
      { z: 6.85,   xAbs: 4.65 },
      { z: 11.85,  xAbs: 4.25 },
      { z: 16.65,  xAbs: 4.25 }
    ];
    const CATHEDRAL_SOLID_PILLARS = [
      ...CATHEDRAL_COLUMN_ROWS.flatMap(({ z, xAbs }) => [
        { x: -xAbs, z, r: 0.86, maxY: 9.65, isColumn: true },
        { x: xAbs,  z, r: 0.86, maxY: 9.65, isColumn: true }
      ]),
      { x: -3.65, z: 0.00, r: 0.68, maxY: 1.95, isColumn: false },
      { x: 3.65,  z: 0.00, r: 0.68, maxY: 1.95, isColumn: false }
    ];

    function clampPointToCathedralRoom(pt, isTarget = false) {
      const margin = isTarget ? 0.15 : 0.0;
      pt.x = Math.max(CATHEDRAL_BOUNDS.minX - margin, Math.min(CATHEDRAL_BOUNDS.maxX + margin, pt.x));
      pt.z = Math.max(CATHEDRAL_BOUNDS.minZ - margin, Math.min(CATHEDRAL_BOUNDS.maxZ + margin, pt.z));
      // Account for the sloped side-aisle ceiling vault outside x = +/-4.15
      const aisleDrop = Math.max(0, Math.abs(pt.x) - 4.15) * 0.55;
      const localMaxY = Math.min(CATHEDRAL_BOUNDS.maxY, 9.05 - aisleDrop);
      const localMinY = isTarget ? 0.20 : CATHEDRAL_BOUNDS.minY;
      pt.y = Math.max(localMinY, Math.min(localMaxY, pt.y));
    }

    function enforceCathedralBoundsAndSolidColumns(prevPos, curPos, targetPos) {
      clampPointToCathedralRoom(targetPos, true);
      clampPointToCathedralRoom(curPos, false);

      if (isAnimatingMove) {
        if (Math.abs(curPos.x) < 2.48 && Math.abs(curPos.z) < 2.38) {
          curPos.y = Math.max(curPos.y, BOARD_SURFACE_Y + 0.30);
        }
        return;
      }

      const x0 = prevPos ? prevPos.x : curPos.x;
      const z0 = prevPos ? prevPos.z : curPos.z;
      let x1 = curPos.x;
      let z1 = curPos.z;
      const moveDx = x1 - x0;
      const moveDz = z1 - z0;
      const moveLenSq = moveDx * moveDx + moveDz * moveDz;
      const moveLen = Math.sqrt(moveLenSq);
      const isContinuousStep = Boolean(prevPos) && moveLen > 1e-5 && moveLen < 8.0;

      for (const p of CATHEDRAL_SOLID_PILLARS) {
        if (curPos.y > p.maxY) continue;

        let tClosest = 1.0;
        if (isContinuousStep) {
          tClosest = ((p.x - x0) * moveDx + (p.z - z0) * moveDz) / moveLenSq;
          tClosest = Math.max(0.0, Math.min(1.0, tClosest));
        }
        const cxSeg = x0 + moveDx * tClosest;
        const czSeg = z0 + moveDz * tClosest;
        const dSeg = isContinuousStep ? Math.hypot(cxSeg - p.x, czSeg - p.z) : Infinity;
        const dEnd = Math.hypot(x1 - p.x, z1 - p.z);

        if (dSeg < p.r || dEnd < p.r) {
          if (typeof window.__wizardChessTelemetry === 'object' && window.__wizardChessTelemetry && p.isColumn) {
            window.__wizardChessTelemetry.columnDeflections = (window.__wizardChessTelemetry.columnDeflections || 0) + 1;
          }

          if (isContinuousStep) {
            // Smooth tangential circumferential slide around the column
            const startAng = Math.atan2(z0 - p.z, x0 - p.x);
            const endAng = Math.atan2(z1 - p.z, x1 - p.x);
            let deltaAng = endAng - startAng;
            while (deltaAng > Math.PI) deltaAng -= Math.PI * 2;
            while (deltaAng < -Math.PI) deltaAng += Math.PI * 2;

            // Project step onto unit tangent at startAng; if pushing dead-on into column center, bias toward center aisle
            const tanX = -Math.sin(startAng);
            const tanZ = Math.cos(startAng);
            let tangMove = moveDx * tanX + moveDz * tanZ;
            if (Math.abs(tangMove) < moveLen * 0.18) {
              const aisleSign = (p.x >= 0 ? -1 : 1) * Math.sign(moveDz || 1);
              tangMove = (tangMove >= 0 ? 1 : aisleSign || 1) * moveLen * 0.65;
            }
            const arcStep = Math.sign(deltaAng || tangMove || 1) * Math.max(Math.abs(deltaAng), Math.min(Math.PI * 0.35, Math.abs(tangMove) / p.r));
            const newAng = startAng + arcStep;
            x1 = p.x + Math.cos(newAng) * p.r;
            z1 = p.z + Math.sin(newAng) * p.r;
          } else {
            const radX = x1 - p.x;
            const radZ = z1 - p.z;
            const radLen = Math.hypot(radX, radZ);
            if (radLen > 1e-4) {
              x1 = p.x + (radX / radLen) * p.r;
              z1 = p.z + (radZ / radLen) * p.r;
            } else {
              x1 = p.x + (p.x >= 0 ? -p.r : p.r);
              z1 = p.z;
            }
          }
        }
      }

      // Solid Black Marble Altar (4.40m x 4.20m slab + pedestal) & Chessboard collision
      // Prevents the camera from passing down through either the chessboard OR the surrounding black marble altar rim
      const ALTAR_TOP_Y = 0.722;
      const ALTAR_HALF_X = 2.48; // 2.22m black marble slab half-width + 0.26m camera frustum near-clip margin
      const ALTAR_HALF_Z = 2.38; // 2.12m black marble slab half-depth + 0.26m camera frustum near-clip margin
      const BOARD_HALF_XZ = 1.66;
      if (Math.abs(targetPos.x) < 2.36 && Math.abs(targetPos.z) < 2.26) {
        const minTargetY =
          Math.abs(targetPos.x) < 1.56 && Math.abs(targetPos.z) < 1.56
            ? BOARD_SURFACE_Y + 0.05
            : ALTAR_TOP_Y + 0.05;
        if (targetPos.y < minTargetY) {
          targetPos.y = minTargetY;
        }
      }
      if (Math.abs(x1) < ALTAR_HALF_X && Math.abs(z1) < ALTAR_HALF_Z) {
        const isOverChessboard = Math.abs(x1) < BOARD_HALF_XZ && Math.abs(z1) < BOARD_HALF_XZ;
        const solidAltarTopY = isOverChessboard ? (BOARD_SURFACE_Y + 0.25) : (ALTAR_TOP_Y + 0.28); // 1.035m on board, 1.002m on black marble altar
        if (curPos.y < solidAltarTopY) {
          const wasInsideAltarFootprint =
            Boolean(prevPos) &&
            Math.abs(x0) < ALTAR_HALF_X - 0.005 &&
            Math.abs(z0) < ALTAR_HALF_Z - 0.005;
          const wasAboveAltarSlab =
            wasInsideAltarFootprint ||
            (Boolean(prevPos) && prevPos.y >= ALTAR_TOP_Y - 0.04) ||
            curPos.y >= ALTAR_TOP_Y - 0.10;
          if (wasAboveAltarSlab) {
            curPos.y = Math.max(curPos.y, solidAltarTopY);
          } else {
            const penX = ALTAR_HALF_X - Math.abs(x1);
            const penZ = ALTAR_HALF_Z - Math.abs(z1);
            if (penX < penZ) {
              x1 = (x1 >= 0 ? 1 : -1) * ALTAR_HALF_X;
            } else {
              z1 = (z1 >= 0 ? 1 : -1) * ALTAR_HALF_Z;
            }
          }
        }
      }

      // Solid Marble & Obsidian Chess Pieces collision during manual camera movement
      // (Bypassed when isAnimatingMove is true so automated duel/attack camera choreography never gets pinned between statues)
      if (
        !isAnimatingMove &&
        curPos.y < BOARD_SURFACE_Y + 0.85 &&
        typeof boardState === 'object' &&
        Array.isArray(boardState)
      ) {
        const pieceRad = 0.185;
        for (let r = 0; r < 8; r++) {
          const row = boardState[r];
          if (!row) continue;
          for (let c = 0; c < 8; c++) {
            const pc = row[c];
            if (!pc || !pc.mesh || !pc.mesh.parent) continue;
            const px = pc.mesh.position.x;
            const pz = pc.mesh.position.z;
            const pieceH = (typeof PIECE_HEIGHTS === 'object' && PIECE_HEIGHTS[pc.type]) ? PIECE_HEIGHTS[pc.type] : 0.42;
            const pieceTopY = pc.mesh.position.y + pieceH + 0.10;
            if (curPos.y >= pieceTopY) continue;

            let tPiece = 1.0;
            if (isContinuousStep) {
              tPiece = ((px - x0) * moveDx + (pz - z0) * moveDz) / moveLenSq;
              tPiece = Math.max(0.0, Math.min(1.0, tPiece));
            }
            const cxP = x0 + moveDx * tPiece;
            const czP = z0 + moveDz * tPiece;
            const dSegP = isContinuousStep ? Math.hypot(cxP - px, czP - pz) : Infinity;
            const dEndP = Math.hypot(x1 - px, z1 - pz);

            if (dSegP < pieceRad || dEndP < pieceRad) {
              if (
                prevPos &&
                prevPos.y >= pieceTopY - 0.08 &&
                Math.hypot(x0 - px, z0 - pz) < pieceRad * 0.85
              ) {
                curPos.y = Math.max(curPos.y, pieceTopY);
              } else {
                const radX = x1 - px;
                const radZ = z1 - pz;
                const radLen = Math.hypot(radX, radZ);
                if (radLen > 1e-4) {
                  x1 = px + (radX / radLen) * pieceRad;
                  z1 = pz + (radZ / radLen) * pieceRad;
                } else {
                  x1 = px + pieceRad;
                }
              }
            }
          }
        }
      }

      curPos.x = x1;
      curPos.z = z1;
      clampPointToCathedralRoom(curPos, false);

      // Update minimum column clearance telemetry across all 12 freestanding columns
      if (typeof window.__wizardChessTelemetry === 'object' && window.__wizardChessTelemetry) {
        let minClear = Infinity;
        for (const p of CATHEDRAL_SOLID_PILLARS) {
          if (!p.isColumn) continue;
          const d = Math.hypot(curPos.x - p.x, curPos.z - p.z);
          if (d < minClear) minClear = d;
        }
        window.__wizardChessTelemetry.lastColumnClearance = Number(minClear.toFixed(3));
        if (
          window.__wizardChessTelemetry.minColumnClearance === undefined ||
          minClear < window.__wizardChessTelemetry.minColumnClearance
        ) {
          window.__wizardChessTelemetry.minColumnClearance = Number(minClear.toFixed(3));
        }
      }
    }

    function createSculptedFlameTongueShader(cfg) {
      const uniforms = {
        uTime: { value: 0 },
        uZMin: { value: cfg.zMin },
        uZMax: { value: cfg.zMax },
        uLayerSeed: { value: cfg.layerSeed },
        uStrength: { value: cfg.strength },
        uOpacity: { value: cfg.opacity },
        uBaseColor: { value: new THREE.Color(...cfg.baseColor) },
        uMidColor: { value: new THREE.Color(...cfg.midColor) },
        uTipColor: { value: new THREE.Color(...cfg.tipColor) }
      };
      brazierFireUniforms.push(uniforms);

      return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          uniform float uTime;
          uniform float uZMin;
          uniform float uZMax;
          uniform float uLayerSeed;
          varying vec3 vLocalPos;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          varying float vHeightNorm;

          void main() {
            vec3 pos = position;
            float h = clamp((pos.y - uZMin) / max(0.01, uZMax - uZMin), 0.0, 1.0);
            vHeightNorm = h;

            // Each brazier is centered at X = +/- 3.65, Z = 0.65 in local mesh space (world Z = 0.00)
            vec2 bCenter = vec2(sign(pos.x) * 3.65, 0.65);
            vec2 relXZ = vec2(pos.x, pos.z) - bCenter;

            // Distinct phase per sculpted tongue & fire layer so all 27 tongues dance independently
            float tonguePhase = relXZ.x * 14.0 + relXZ.y * 12.0 + uLayerSeed * 1.9;
            float sway = pow(h, 1.05);

            // Multi-frequency upward-propagating lateral flame wave (pinned at h = 0 in the logs)
            float waveX = sin(pos.y * 4.6 - uTime * 6.4 + tonguePhase) * 0.088
                        + cos(pos.y * 8.2 - uTime * 9.8 + tonguePhase * 1.35) * 0.048;
            float waveZ = cos(pos.y * 4.3 - uTime * 5.9 + tonguePhase * 1.15) * 0.088
                        + sin(pos.y * 7.8 - uTime * 9.1 + tonguePhase * 0.85) * 0.048;

            // Swirling thermal vortex twist + radial breathing around each brazier bowl
            float twistAngle = sin(uTime * 4.2 + pos.y * 4.5 + uLayerSeed) * 0.30 * sway;
            float cA = cos(twistAngle);
            float sA = sin(twistAngle);
            vec2 twistedXZ = vec2(relXZ.x * cA - relXZ.y * sA, relXZ.x * sA + relXZ.y * cA);
            float radialPulse = 1.0 + sin(uTime * 5.2 - h * 4.0 + tonguePhase) * 0.14 * sway;

            pos.x = bCenter.x + twistedXZ.x * radialPulse + waveX * sway;
            pos.z = bCenter.y + twistedXZ.y * radialPulse + waveZ * sway;

            // Active vertical flame-tongue licking (base h = 0 stays strictly anchored at uZMin)
            float lickStretch = 1.0 + (
              sin(uTime * 5.8 + tonguePhase * 1.3) * 0.22 +
              cos(uTime * 9.2 - tonguePhase * 0.9) * 0.12
            ) * smoothstep(0.05, 0.85, h);
            pos.y = uZMin + (pos.y - uZMin) * lickStretch;

            vLocalPos = pos;
            vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPosition.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uZMin;
          uniform float uZMax;
          uniform float uLayerSeed;
          uniform float uStrength;
          uniform float uOpacity;
          uniform vec3 uBaseColor;
          uniform vec3 uMidColor;
          uniform vec3 uTipColor;
          varying vec3 vLocalPos;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          varying float vHeightNorm;

          float hash3(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
          }

          float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x),
                f.y
              ),
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x),
                f.y
              ),
              f.z
            );
          }

          void main() {
            float h = clamp(vHeightNorm, 0.0, 1.0);
            vec3 V = normalize(cameraPosition - vWorldPos);
            vec3 N = normalize(vWorldNormal);

            // Real-time port of Cycles LayerWeight.Facing^2.4 gaseous feathering
            float facing = clamp(abs(dot(N, V)), 0.0, 1.0);
            float powFacing = pow(facing, 2.25);

            // Fast upward-convecting 3D flame turbulence that actively carves the flame tips
            float n1 = noise3(vec3(vLocalPos.x * 5.4, vLocalPos.y * 4.8 - uTime * 6.8, vLocalPos.z * 5.4 + uLayerSeed));
            float n2 = noise3(vec3(vLocalPos.x * 10.2 + 1.9, vLocalPos.y * 8.5 - uTime * 10.5, vLocalPos.z * 10.2 - uLayerSeed));
            float shimmer = mix(n1, n2, 0.45);

            // Dynamic tip erosion so flame tongues visibly lick up and recede
            float erodedH = clamp(h + (shimmer - 0.48) * 0.42 * smoothstep(0.08, 0.85, h), 0.0, 1.0);

            // Combine eroded height and (1.0 - facing) so grazing edges shift toward fiery orange-crimson
            float heatCoord = clamp(erodedH + (1.0 - facing) * 0.36 + (shimmer - 0.5) * 0.22, 0.0, 1.0);
            vec3 col = mix(uBaseColor, uMidColor, smoothstep(0.0, 0.45, heatCoord));
            col = mix(col, uTipColor, smoothstep(0.45, 0.90, heatCoord));

            float zAlpha = mix(0.96, 0.72, smoothstep(0.0, 0.68, erodedH)) * (1.0 - smoothstep(0.64, 0.98, erodedH));
            float baseSoft = smoothstep(0.0, 0.06, h);
            float flickerPulse = 0.76 + 0.48 * shimmer;
            float alpha = clamp(zAlpha * baseSoft * powFacing * uOpacity * flickerPulse, 0.0, 1.0);
            if (alpha < 0.004) discard;

            gl_FragColor = vec4(col * uStrength, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
    }

    function createCharredEmberLogsShader() {
      const uniforms = {
        uTime: { value: 0 }
      };
      brazierFireUniforms.push(uniforms);

      return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          varying vec3 vLocalPos;
          varying vec3 vWorldNormal;
          void main() {
            vLocalPos = position;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec3 vLocalPos;
          varying vec3 vWorldNormal;

          float hash3(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
          }

          float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x),
                f.y
              ),
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x),
                f.y
              ),
              f.z
            );
          }

          void main() {
            // Dark charred timber bark (#0B0807) fissured with glowing incandescent 2200K orange cracks & glowing coal bed base
            float nCrack = noise3(vLocalPos * 18.0);
            float nFine = noise3(vLocalPos * 38.0 + vec3(0.0, uTime * 0.25, 0.0));
            float pulse = 0.88 + 0.12 * sin(uTime * 2.3 + vLocalPos.x * 4.0 + vLocalPos.z * 4.0);

            // Lower coal cone (y < 0.59) vs upper charred logs (y >= 0.59)
            float isCoalBed = 1.0 - smoothstep(0.56, 0.61, vLocalPos.y);
            float crackMask = smoothstep(0.68, 0.88, nCrack * 0.7 + nFine * 0.3);
            float underGlow = clamp(-vWorldNormal.y * 0.45 + 0.35, 0.0, 1.0) * smoothstep(0.72, 0.56, vLocalPos.y);

            vec3 charBark = vec3(0.035, 0.025, 0.020);
            vec3 emberOrange = vec3(1.0, 0.36, 0.04) * 1.45 * pulse;
            vec3 hotCoal = vec3(1.0, 0.58, 0.12) * 1.65 * pulse;

            float emberWeight = clamp(isCoalBed * (0.45 + 0.55 * nFine) + crackMask * 0.85 + underGlow * 0.45, 0.0, 1.0);
            vec3 col = mix(charBark, emberOrange, emberWeight);
            col = mix(col, hotCoal, smoothstep(0.72, 0.96, emberWeight));

            gl_FragColor = vec4(col, 1.0);
          }
        `
      });
    }

    function createBrazierWarmGlowHalos() {
      const glowTex = createSoftGlowTexture();
      const brazierCenters = [
        { x: -3.65, y: 0.56, z: 0.00, seed: 1.3 },
        { x: 3.65, y: 0.56, z: 0.00, seed: 5.8 }
      ];

      for (const b of brazierCenters) {
        // Layer 1: Inner warm hearth core glow halo centered in the flame body
        const coreGlowMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xffb866,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const coreSprite = new THREE.Sprite(coreGlowMat);
        coreSprite.position.set(b.x, b.y + 0.28, b.z);
        coreSprite.scale.set(1.15, 1.25, 1.0);
        coreSprite.userData = { baseOpacity: 0.42, seed: b.seed };
        scene.add(coreSprite);
        brazierGlowSprites.push(coreSprite);

        // Layer 2: Wide, soft atmospheric warm glow halo bathing the surrounding air & ironwork
        const haloGlowMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xff8524,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const haloSprite = new THREE.Sprite(haloGlowMat);
        haloSprite.position.set(b.x, b.y + 0.38, b.z);
        haloSprite.scale.set(2.45, 2.30, 1.0);
        haloSprite.userData = { baseOpacity: 0.28, seed: b.seed + 2.1 };
        scene.add(haloSprite);
        brazierGlowSprites.push(haloSprite);
      }
    }

    createBrazierWarmGlowHalos();

    // Consolidated Window Point Lights (4 side-aisle + 2 end-wall lights instead of 22 separate PointLights;
    // fine local window & column raking relief is evaluated analytically in applyCathedralStoneRealismShader)
    for (const wz of [-8.8, 8.2]) {
      for (const sideSign of [-1, 1]) {
        const winLight = new THREE.PointLight(0x90beff, 4.2, 16.5, 1.35);
        winLight.position.set(sideSign * 5.3, 4.1, wz);
        scene.add(winLight);
      }
    }
    const northWinLight = new THREE.PointLight(0x9bc4ff, 6.4, 20.0, 1.30);
    northWinLight.position.set(0, 5.2, -18.2);
    scene.add(northWinLight);

    const southWinLight = new THREE.PointLight(0xffb85c, 6.4, 20.0, 1.30);
    southWinLight.position.set(0, 5.2, 18.2);
    scene.add(southWinLight);

    // Impact Flash Light (kept visible=true with intensity=0 when idle so Three.js never recompiles shaders mid-attack!)
    const impactFlashLight = new THREE.PointLight(0xffb74d, 0, 6.0, 1.5);
    impactFlashLight.visible = true;
    scene.add(impactFlashLight);

    // =========================================================================
    // Materials for White & Black Sculpted Stone Checkers Pieces & Golden Damas
    // =========================================================================
    const whitePieceMat = new THREE.MeshStandardMaterial({
      color: 0xe6dfd0,
      roughness: 0.34,
      metalness: 0.06
    });

    const blackPieceMat = new THREE.MeshStandardMaterial({
      color: 0x222630,
      roughness: 0.28,
      metalness: 0.24
    });

    const whiteDamaMat = new THREE.MeshStandardMaterial({
      color: 0xfbf5e6,
      roughness: 0.24,
      metalness: 0.28,
      emissive: 0x3b2c0a,
      emissiveIntensity: 0.22
    });

    const blackDamaMat = new THREE.MeshStandardMaterial({
      color: 0x2a2620,
      roughness: 0.22,
      metalness: 0.45,
      emissive: 0x332206,
      emissiveIntensity: 0.26
    });

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.26,
      metalness: 0.86
    });

    const damaCrownGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      roughness: 0.16,
      metalness: 0.94,
      emissive: 0xd49b1a,
      emissiveIntensity: 0.48
    });

    const forgedSteelMat = new THREE.MeshStandardMaterial({
      color: 0xdce4ee,
      roughness: 0.20,
      metalness: 0.88,
      emissive: 0x222832,
      emissiveIntensity: 0.25
    });

    // =========================================================================
    // Asset Loading (Cathedral GLB + 12 Rigged Piece GLBs)
    // =========================================================================
    const gltfLoader = new GLTFLoader();
    const pieceTemplates = {};
    const activeMixers = [];
    const shatterDebris = [];
    const clock = new THREE.Clock();

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);
    const squareHighlightsGroup = new THREE.Group();
    scene.add(squareHighlightsGroup);
    const boardSquareMeshes = [];

    function buildChessBoardGrid() {
      const tileH = 0.036;
      const sqGeo = new THREE.BoxGeometry(BOARD_SQ_SIZE * 0.985, tileH, BOARD_SQ_SIZE * 0.985);
      const lightSqMat = new THREE.MeshStandardMaterial({
        color: 0xdcd3c2,
        roughness: 0.38,
        metalness: 0.06
      });
      const darkSqMat = new THREE.MeshStandardMaterial({
        color: 0x14171f,
        roughness: 0.28,
        metalness: 0.18
      });

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const isLight = (r + c) % 2 === 0;
          const sqMesh = new THREE.Mesh(sqGeo, isLight ? lightSqMat : darkSqMat);
          const pos = boardToWorld(r, c);
          sqMesh.position.set(pos.x, BOARD_SURFACE_Y - tileH * 0.5, pos.z);
          sqMesh.receiveShadow = true;
          sqMesh.userData = { r, c, isSquare: true };
          boardGroup.add(sqMesh);
          boardSquareMeshes.push(sqMesh);
        }
      }

      // Sculpted Golden Border Frame around the 8x8 tiles on top of the Obsidian Altar
      const halfB = 4.0 * BOARD_SQ_SIZE;
      const rimW = 0.06;
      const rimH = 0.042;
      const horizGeo = new THREE.BoxGeometry(halfB * 2 + rimW * 2, rimH, rimW);
      const vertGeo = new THREE.BoxGeometry(rimW, rimH, halfB * 2);
      for (const s of [-1, 1]) {
        const hBar = new THREE.Mesh(horizGeo, goldTrimMat);
        hBar.position.set(0, BOARD_SURFACE_Y - rimH * 0.45, s * (halfB + rimW * 0.5));
        hBar.receiveShadow = true;
        boardGroup.add(hBar);

        const vBar = new THREE.Mesh(vertGeo, goldTrimMat);
        vBar.position.set(s * (halfB + rimW * 0.5), BOARD_SURFACE_Y - rimH * 0.45, 0);
        vBar.receiveShadow = true;
        boardGroup.add(vBar);
      }
    }

    buildChessBoardGrid();

    // =========================================================================
    // Native Baked Wall/Column Stone (Original Ashlar) & Floor Stone (Abbey Flagstone)
    // =========================================================================
    const WALL_STONE_LOOKS = [
      {
        name: 'Original Ashlar',
        fullName: 'Original Ashlar',
        useOriginalBaked: true,
        roughness: 0.78,
        normalScale: 1.18,
        colNormalScale: 1.06
      }
    ];

    const FLOOR_STONE_LOOKS = [
      {
        name: 'Abbey Flagstone',
        fullName: 'Abbey Flagstone',
        useOriginalBaked: true,
        roughness: 0.80,
        metalness: 0.02,
        normalScale: 1.18
      }
    ];

    let currentWallStoneLookIdx = 0;
    let currentFloorStoneLookIdx = 0;
    const cathedralWallMats = [];
    const cathedralColumnMats = [];
    const cathedralFloorMats = [];

    // Precomputed 128x128 tileable micro-chisel grain DataTexture (replaces 32 per-pixel 3D hashes every frame)
    const stoneMicroGrainTex = (() => {
      const size = 128;
      const data = new Uint8Array(size * size * 4);
      const fract = (v) => v - Math.floor(v);
      const hash2 = (x, y, s) => fract(Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453);
      const smoothNoise = (u, v, period, seed) => {
        const gx = u * period;
        const gy = v * period;
        const x0 = Math.floor(gx) % period;
        const y0 = Math.floor(gy) % period;
        const x1 = (x0 + 1) % period;
        const y1 = (y0 + 1) % period;
        const fx = gx - Math.floor(gx);
        const fy = gy - Math.floor(gy);
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const n00 = hash2(x0, y0, seed);
        const n10 = hash2(x1, y0, seed);
        const n01 = hash2(x0, y1, seed);
        const n11 = hash2(x1, y1, seed);
        return (n00 + (n10 - n00) * sx) * (1 - sy) + (n01 + (n11 - n01) * sx) * sy;
      };
      for (let y = 0; y < size; y++) {
        const v = y / size;
        for (let x = 0; x < size; x++) {
          const u = x / size;
          const mG1 = smoothNoise(u, v, 24, 1.7);
          const mG2 = smoothNoise(u, v, 64, 7.3);
          const idx = (y * size + x) * 4;
          data[idx] = Math.max(0, Math.min(255, Math.round(mG1 * 255)));
          data[idx + 1] = Math.max(0, Math.min(255, Math.round(mG2 * 255)));
          data[idx + 2] = Math.max(0, Math.min(255, Math.round((0.5 + (mG1 - mG2) * 0.7) * 255)));
          data[idx + 3] = 255;
        }
      }
      const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      return tex;
    })();

    // =========================================================================
    // Realism Stone Shader Enhancement (inspired by 0beqz/realism-effects HBAO/HBIL
    // & gkjohnson/three-gpu-pathtracer Cavity Micro-Occlusion + Specular Occlusion)
    // =========================================================================
    function applyCathedralStoneRealismShader(mat, isFloor = false) {
      if (!mat || mat.userData.hasRealismStoneShader) return;
      mat.userData.hasRealismStoneShader = true;
      mat.customProgramCacheKey = () => (isFloor ? 'cathedral-floor-realism-v3' : 'cathedral-stone-realism-v3');

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uCavityStrength = { value: isFloor ? 0.58 : 0.72 };
        shader.uniforms.uMicroDetailStrength = { value: isFloor ? 0.14 : 0.18 };
        shader.uniforms.uFireBounceStrength = { value: isFloor ? 0.16 : 0.24 };
        shader.uniforms.uMicroGrainMap = { value: stoneMicroGrainTex };

        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vStoneWorldPos;`
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vStoneWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vStoneWorldPos;
          uniform float uCavityStrength;
          uniform float uMicroDetailStrength;
          uniform float uFireBounceStrength;
          uniform sampler2D uMicroGrainMap;`
        );

        // Extract normal-map slope magnitude for Mortar/Crevice Cavity AO & Specular Micro-Occlusion,
        // plus precomputed tileable micro-chisel grain lookup (zero per-pixel 3D hash loops!).
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `float stoneCavityAO = 1.0;
          #include <normal_fragment_maps>
          #ifdef USE_NORMALMAP_TANGENTSPACE
            vec2 rawNrmXY = texture2D(normalMap, vNormalMapUv).xy * 2.0 - 1.0;
            float slopeSq = dot(rawNrmXY, rawNrmXY);
            stoneCavityAO = clamp(1.0 - slopeSq * uCavityStrength, 0.36, 1.0);
          #endif
          vec2 microUv = (vStoneWorldPos.xz + vStoneWorldPos.xy * 0.618) * 0.85;
          vec3 mgSample = texture2D(uMicroGrainMap, microUv).rgb - 0.5;
          float mG1 = mgSample.r;
          float mG2 = mgSample.g;
          vec3 microPerturb = vec3(mG1, mG2, mgSample.b) * uMicroDetailStrength;
          normal = normalize(normal + microPerturb * 0.22);
          diffuseColor.rgb *= mix(0.92, 1.07, clamp(0.5 + (mG1 * 0.65 + mG2 * 0.35), 0.0, 1.0));
          diffuseColor.rgb *= mix(1.0, stoneCavityAO, 0.68);
          roughnessFactor = clamp(roughnessFactor + (1.0 - stoneCavityAO) * 0.34 - mG1 * 0.06, 0.14, 0.99);`
        );

        // Add Horizon-Based Indirect Bounce (HBIL) from the twin fire cauldrons & upper lancet windows,
        // and apply Specular Micro-Occlusion in mortar crevices so grooves never have plastic shine.
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          reflectedLight.directDiffuse *= mix(1.0, stoneCavityAO, 0.45);
          reflectedLight.indirectDiffuse *= stoneCavityAO;
          reflectedLight.directSpecular *= stoneCavityAO * stoneCavityAO;
          reflectedLight.indirectSpecular *= stoneCavityAO * stoneCavityAO;

          // Physical multi-bounce warm firelight GI from the twin atrium braziers & flanking columns
          vec3 toBrazierL = vec3(-3.65, 1.35, 0.0) - vStoneWorldPos;
          vec3 toBrazierR = vec3(3.65, 1.35, 0.0) - vStoneWorldPos;
          float distSqL = dot(toBrazierL, toBrazierL) + 2.6;
          float distSqR = dot(toBrazierR, toBrazierR) + 2.6;
          vec3 wNormal = inverseTransformDirection(normal, viewMatrix);
          float bounceL = max(0.0, dot(wNormal, normalize(toBrazierL)) * 0.65 + 0.35) / distSqL;
          float bounceR = max(0.0, dot(wNormal, normalize(toBrazierR)) * 0.65 + 0.35) / distSqR;
          vec3 fireBounceGI = vec3(1.0, 0.54, 0.20) * (bounceL + bounceR) * 5.2 * uFireBounceStrength * stoneCavityAO;

          // Analytic raking window-sill & end-wall grazing light (replaces 14 static PointLights at zero BRDF cost)
          vec3 toSideWin = vec3(sign(vStoneWorldPos.x) * 6.8, 3.8, vStoneWorldPos.z) - vStoneWorldPos;
          float sideWinDistSq = dot(toSideWin, toSideWin) + 3.2;
          float sideWinGraze = max(0.0, dot(wNormal, normalize(toSideWin)) * 0.75 + 0.25) / sideWinDistSq;
          vec3 windowGrazeGI = vec3(0.84, 0.89, 0.96) * sideWinGraze * 0.95 * stoneCavityAO;
          reflectedLight.indirectDiffuse += (fireBounceGI + windowGrazeGI) * diffuseColor.rgb;`
        );
      };
      mat.needsUpdate = true;
    }

    function setWallStoneLook() {
      currentWallStoneLookIdx = 0;
      const cfg = WALL_STONE_LOOKS[0];

      for (const mat of cathedralWallMats) {
        mat.map = mat.userData.origMap || mat.map;
        mat.normalMap = mat.userData.origNormalMap || mat.normalMap;
        mat.roughnessMap = mat.userData.origRoughnessMap || mat.roughnessMap;
        mat.emissiveMap = mat.userData.origEmissiveMap || null;
        mat.emissiveIntensity = 0.08;
        mat.roughness = cfg.roughness;
        mat.metalness = 0.02;
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.45;
        if (mat.color) mat.color.setRGB(1, 1, 1);
        if (mat.normalScale) mat.normalScale.set(cfg.normalScale, cfg.normalScale);
        mat.needsUpdate = true;
      }

      for (const mat of cathedralColumnMats) {
        mat.map = mat.userData.origMap || mat.map;
        mat.normalMap = mat.userData.origNormalMap || mat.normalMap;
        mat.roughnessMap = mat.userData.origRoughnessMap || mat.roughnessMap;
        mat.emissiveMap = mat.userData.origEmissiveMap || null;
        mat.emissiveIntensity = 0.08;
        mat.roughness = cfg.roughness;
        mat.metalness = 0.02;
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.48;
        if (mat.color) mat.color.setRGB(1, 1, 1);
        if (mat.normalScale) mat.normalScale.set(cfg.colNormalScale, cfg.colNormalScale);
        mat.needsUpdate = true;
      }

      return { index: 0, name: cfg.name, fullName: cfg.fullName };
    }

    function setFloorStoneLook() {
      currentFloorStoneLookIdx = 0;
      const cfg = FLOOR_STONE_LOOKS[0];

      for (const mat of cathedralFloorMats) {
        mat.map = mat.userData.origMap || mat.map;
        mat.normalMap = mat.userData.origNormalMap || mat.normalMap;
        mat.roughnessMap = mat.userData.origRoughnessMap || mat.roughnessMap;
        mat.emissiveMap = mat.userData.origEmissiveMap || null;
        mat.emissiveIntensity = 0.06;
        mat.roughness = cfg.roughness;
        mat.metalness = cfg.metalness;
        if (mat.color) mat.color.setRGB(1, 1, 1);
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.36;
        if (mat.normalScale) mat.normalScale.set(cfg.normalScale, cfg.normalScale);
        mat.needsUpdate = true;
      }

      return { index: 0, name: cfg.name, fullName: cfg.fullName };
    }

    function nextWallStoneLook() {
      return setWallStoneLook(0);
    }
    function prevWallStoneLook() {
      return setWallStoneLook(0);
    }
    function nextFloorStoneLook() {
      return setFloorStoneLook(0);
    }
    function prevFloorStoneLook() {
      return setFloorStoneLook(0);
    }

    async function loadAllAssets() {
      const loaderBar = document.getElementById('loader-bar');
      const loaderText = document.getElementById('loader-text');
      const totalItems = PIECE_TYPES.length + 1;

      async function loadGltfModel(baseName) {
        let arrayBuffer = null;
        try {
          const resB64 = await fetch(`./assets/glb/${baseName}.glb.gz.b64`);
          if (resB64.ok) {
            const b64Text = (await resB64.text()).trim();
            if (b64Text.length > 64) {
              const binStr = atob(b64Text);
              const gzBytes = new Uint8Array(binStr.length);
              for (let i = 0; i < binStr.length; i++) {
                gzBytes[i] = binStr.charCodeAt(i);
              }
              const ds = new DecompressionStream('gzip');
              const stream = new Blob([gzBytes]).stream().pipeThrough(ds);
              arrayBuffer = await new Response(stream).arrayBuffer();
            }
          }
        } catch (e) {}

        if (!arrayBuffer) {
          const resGlb = await fetch(`./assets/glb/${baseName}.glb`);
          if (!resGlb.ok) throw new Error(`Failed to fetch ${baseName}`);
          arrayBuffer = await resGlb.arrayBuffer();
        }

        return new Promise((resolve, reject) => {
          gltfLoader.parse(arrayBuffer, './assets/glb/', (gltf) => resolve(gltf), (err) => reject(err));
        });
      }
      let loadedCount = 0;

      function bumpProgress(label) {
        loadedCount++;
        const pct = Math.min(100, Math.round((loadedCount / totalItems) * 100));
        if (loaderBar) loaderBar.style.width = `${pct}%`;
        if (loaderText) loaderText.textContent = label;
      }

      // Instantiate custom GLSL shaders for the 3 sculpted brazier flame layers & charred ember logs
      const flameCoreShader = createSculptedFlameTongueShader({
        baseColor: [1.0, 0.96, 0.72],
        midColor: [1.0, 0.64, 0.12],
        tipColor: [1.0, 0.36, 0.03],
        strength: 1.85,
        opacity: 0.92,
        zMin: 0.60,
        zMax: 1.64,
        layerSeed: 0.0
      });
      const flameMidShader = createSculptedFlameTongueShader({
        baseColor: [1.0, 0.78, 0.25],
        midColor: [1.0, 0.40, 0.04],
        tipColor: [0.92, 0.16, 0.01],
        strength: 1.35,
        opacity: 0.82,
        zMin: 0.60,
        zMax: 1.52,
        layerSeed: 2.1
      });
      const flameOuterShader = createSculptedFlameTongueShader({
        baseColor: [1.0, 0.45, 0.06],
        midColor: [0.88, 0.18, 0.015],
        tipColor: [0.45, 0.03, 0.002],
        strength: 0.95,
        opacity: 0.68,
        zMin: 0.60,
        zMax: 1.36,
        layerSeed: 4.4
      });
      const charredEmberLogsShader = createCharredEmberLogsShader();

      // 1. Load Native Full-Height Cathedral Environment (shifted by z = -0.65 so the Obsidian Altar is centered at 0, 0.7215, 0)
      const maxAniso = renderer.capabilities.getMaxAnisotropy() || 8;
      await new Promise((resolve) => {
        loadGltfModel('option8_cathedral').then(
          (gltf) => {
            const cathedralRoot = gltf.scene;
            cathedralRoot.position.set(0, 0, -0.65);

            cathedralRoot.traverse((child) => {
              if (!child.isMesh) return;
              child.receiveShadow = true;
              const meshName = child.name || '';
              const mNameFirst = (Array.isArray(child.material) ? child.material[0]?.name : child.material?.name) || '';

              if (meshName.includes('Brazier_Flame_Core') || mNameFirst.includes('Flame_Core')) {
                child.material = flameCoreShader;
                child.castShadow = false;
                child.receiveShadow = false;
                child.renderOrder = 12;
                return;
              }
              if (meshName.includes('Brazier_Flame_Mid') || mNameFirst.includes('Flame_Mid')) {
                stripIcosphereSparksFromFlameGeometry(child.geometry);
                child.material = flameMidShader;
                child.castShadow = false;
                child.receiveShadow = false;
                child.renderOrder = 11;
                return;
              }
              if (meshName.includes('Brazier_Flame_Outer') || mNameFirst.includes('Flame_Outer')) {
                child.material = flameOuterShader;
                child.castShadow = false;
                child.receiveShadow = false;
                child.renderOrder = 10;
                return;
              }
              if (meshName.includes('Embers_Logs') || mNameFirst.includes('Ember')) {
                child.material = charredEmberLogsShader;
                child.castShadow = false;
                child.receiveShadow = false;
                return;
              }

              // Only the central Obsidian Altar casts real-time directional shadows;
              // cathedral columns/walls/ceiling and twin braziers use baked 3D Chiaroscuro & BVH ray-traced AO
              // so they never project clipped or directional shadows across the floor.
              const isShadowCasterProp =
                meshName.includes('Obsidian_Altar') ||
                meshName.includes('Altar_Golden_Runes');

              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of mats) {
                if (!mat) continue;
                const mName = mat.name || '';
                const isAmberGlass =
                  mName.includes('Amber') ||
                  mName.includes('Narthex_Amber') ||
                  meshName.includes('Narthex_Amber');
                const isGlass =
                  isAmberGlass ||
                  mName.includes('Glass') ||
                  mName.includes('Lancet') ||
                  mName.includes('Rose') ||
                  meshName.includes('Glass') ||
                  meshName.includes('Window');
                const isRay = mName.includes('GodRay') || meshName.includes('GodRay');

                for (const texKey of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
                  if (mat[texKey]) {
                    mat[texKey].anisotropy = maxAniso;
                    mat[texKey].needsUpdate = true;
                  }
                }

                // Preserve native 1024x1024 GLB-baked textures before any look switching
                if (!mat.userData.origCaptured) {
                  mat.userData.origCaptured = true;
                  mat.userData.origMap = mat.map || null;
                  mat.userData.origNormalMap = mat.normalMap || null;
                  mat.userData.origRoughnessMap = mat.roughnessMap || null;
                  mat.userData.origEmissiveMap = mat.emissiveMap || null;
                }

                if (mat.normalMap && mat.normalScale) {
                  const isDoorMat = mName.includes('Oak') || mName.includes('Door') || meshName.includes('Door');
                  const nScale = isDoorMat ? 1.05 : 1.15;
                  mat.normalScale.set(nScale, nScale);
                }

                if (isAmberGlass) {
                  mat.vertexColors = false;
                  mat.color = new THREE.Color(0xffe6b8);
                  mat.emissive = new THREE.Color(0xffa033);
                  mat.emissiveIntensity = 2.45;
                  mat.roughness = 0.15;
                  mat.metalness = 0.0;
                  mat.side = THREE.DoubleSide;
                  child.castShadow = false;
                } else if (isGlass) {
                  mat.vertexColors = false;
                  mat.color = new THREE.Color(0xdbeeff);
                  mat.emissive = new THREE.Color(0x68a8ff);
                  mat.emissiveIntensity = 2.65;
                  mat.roughness = 0.15;
                  mat.metalness = 0.0;
                  mat.side = THREE.DoubleSide;
                  child.castShadow = false;
                } else if (isRay) {
                  child.visible = false;
                  child.castShadow = false;
                  child.receiveShadow = false;
                } else {
                  if (mat.map) {
                    mat.vertexColors = true;
                  }
                  child.castShadow = isShadowCasterProp;

                  // Register Wall, Column/Arch/Plinth, and Floor stone materials for live 6-look switching & Realism Shader
                  if (mName.includes('Floor') || mName.includes('Flagstone') || meshName.includes('Floor')) {
                    applyCathedralStoneRealismShader(mat, true);
                    if (!cathedralFloorMats.includes(mat)) cathedralFloorMats.push(mat);
                  } else if (
                    mName.includes('Column_Stone') ||
                    mName.includes('Tracery') ||
                    meshName.includes('Plinth') ||
                    meshName.includes('Tracery')
                  ) {
                    applyCathedralStoneRealismShader(mat, false);
                    if (!cathedralColumnMats.includes(mat)) cathedralColumnMats.push(mat);
                  } else if (
                    mName.includes('Gothic_Ashlar') ||
                    mName.includes('Ashlar') ||
                    mName.includes('Vault') ||
                    meshName.includes('Cathedral_Stone')
                  ) {
                    applyCathedralStoneRealismShader(mat, false);
                    if (!cathedralWallMats.includes(mat)) cathedralWallMats.push(mat);
                  }
                }
                mat.needsUpdate = true;
              }
            });

            // Initialize default Look 1/6 (Original Ashlar & Abbey Flagstone) on Wall/Column Stone and Floor Stone
            setWallStoneLook(0);
            setFloorStoneLook(0);
            scene.add(cathedralRoot);

            bumpProgress('Cathedral Architecture Loaded...');
            resolve();
          },
          (err) => {
            console.warn('Cathedral GLB load warning:', err);
            bumpProgress('Cathedral Loaded');
            resolve();
          }
        );
      });

      // 2. Load 6 Sculpted & Rigged Chess Piece Models (shared between White & Black with PBR materials)
      for (const type of PIECE_TYPES) {
        await new Promise((resolve) => {
          loadGltfModel(`${type}_white`).then(
            (gltf) => {
              const toRemove = [];
              gltf.scene.traverse((child) => {
                const nm = child.name || '';
                if (nm.includes('Icosphere') || nm.includes('glTF_not_exported')) {
                  child.visible = false;
                  toRemove.push(child);
                }
              });
              for (const rem of toRemove) {
                if (rem.parent) rem.parent.remove(rem);
              }

              const tpl = {
                scene: gltf.scene,
                animations: gltf.animations || []
              };
              pieceTemplates[`${type}_w`] = tpl;
              pieceTemplates[`${type}_b`] = tpl;
              bumpProgress(`Summoned ${type.toUpperCase()} Statue...`);
              resolve();
            },
            (err) => {
              console.warn(`Piece load warning (${type}):`, err);
              bumpProgress(`Loaded ${type}`);
              resolve();
            }
          );
        });
      }

      document.getElementById('loading-overlay')?.classList.add('hidden');
    }

    // =========================================================================
    // Chess Game State, Complete Move Rules, and AI Engine
    // =========================================================================
    let boardState = Array.from({ length: 8 }, () => Array(8).fill(null));
    let currentTurn = 'w';
    let selectedSquare = null;
    let validMoves = [];
    let isAnimatingMove = false;
    let gameOver = false;
    let capturedByWhite = 0;
    let capturedByBlack = 0;

    // Mode & Player Configuration
    let gameMode = 'single'; // 'single' | 'multi'
    let playerColor = 'w';   // 'w' | 'b' | 'spectator'
    let aiAutoPlay = true;
    let aiTimer = null;

    // Multiplayer State
    let roomCode = null;
    let playerToken = localStorage.getItem('wizard_chess_token') || '';
    let roomEventSource = null;
    let roomPollTimer = null;
    let appliedMoveSeq = 0;
    let appliedResetCount = 0;

    // Camera Animation & Telemetry State
    const cameraTelemetry = {
      lastAttackSamples: [],
      attackCount: 0,
      maxStepDelta: 0,
      columnDeflections: 0,
      minColumnClearance: Infinity,
      lastColumnClearance: Infinity
    };
    window.__wizardChessTelemetry = cameraTelemetry;

    let activeCamTransition = null; // { startPos, endPos, startTarget, endTarget, elapsed, duration }

    function flushOrbitControlsDamping() {
      const wasDamping = orbitControls.enableDamping;
      orbitControls.enableDamping = false;
      orbitControls.update();
      enforceCathedralBoundsAndSolidColumns(null, camera.position, orbitControls.target);
      camera.lookAt(orbitControls.target);
      orbitControls.enableDamping = wasDamping;
    }

    function smoothCameraTo(targetPos, targetLookAt, duration = 0.75) {
      flushOrbitControlsDamping();
      const clampedPos = targetPos.clone();
      const clampedLook = targetLookAt.clone();
      enforceCathedralBoundsAndSolidColumns(clampedPos, clampedPos, clampedLook);
      activeCamTransition = {
        startPos: camera.position.clone(),
        endPos: clampedPos,
        startTarget: orbitControls.target.clone(),
        endTarget: clampedLook,
        elapsed: 0,
        duration: Math.max(0.05, duration)
      };
    }

    function setCameraForSide(color, immediate = false) {
      // White sits at +Z looking toward -Z (across the Obsidian Altar down the Cathedral Nave & Rose Window)
      // Black sits at -Z looking toward +Z (across the Obsidian Altar toward the South Narthex Royal Amber Triptych)
      const zSign = color === 'b' ? -1 : 1;
      const desiredPos = new THREE.Vector3(0, 2.22, zSign * 2.72);
      const desiredTarget = new THREE.Vector3(0, 0.85, zSign * -0.15);
      if (immediate) {
        activeCamTransition = null;
        camera.position.copy(desiredPos);
        orbitControls.target.copy(desiredTarget);
        flushOrbitControlsDamping();
      } else {
        smoothCameraTo(desiredPos, desiredTarget, 0.8);
      }
    }

    const damaHaloGeo = new THREE.TorusGeometry(0.37, 0.032, 16, 36);
    damaHaloGeo.rotateX(Math.PI / 2);

    function instantiatePiece(type, color, r, c) {
      const actualType = type === 'queen' ? 'queen' : 'pawn';
      const isDama = actualType === 'queen';
      const tpl = pieceTemplates[`${actualType}_${color}`];
      let root;
      let mixer = null;
      const actions = {};

      if (tpl && tpl.scene) {
        root = SkeletonUtils.clone(tpl.scene);
        const primaryMat = isDama
          ? (color === 'w' ? whiteDamaMat : blackDamaMat)
          : (color === 'w' ? whitePieceMat : blackPieceMat);
        const trimMat = isDama ? damaCrownGoldMat : goldTrimMat;

        root.traverse((child) => {
          const nm = child.name || '';
          if (nm.includes('Icosphere') || nm.includes('glTF_not_exported')) {
            child.visible = false;
            return;
          }
          if (child.isMesh) {
            const mName = child.material?.name || '';
            if (mName.includes('Gold') || mName.includes('Trim') || mName.includes('Bronze') || mName.includes('Glow')) {
              child.material = trimMat;
            } else if (mName.includes('Steel')) {
              child.material = isDama ? damaCrownGoldMat : forgedSteelMat;
            } else {
              child.material = primaryMat;
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Se for uma Dama coroada (modelo da Rainha), adiciona um halo de coroa dourado luminoso na base do pedestal
        if (isDama) {
          const haloRing = new THREE.Mesh(damaHaloGeo, damaCrownGoldMat);
          haloRing.position.set(0, 0.055, 0);
          haloRing.castShadow = true;
          root.add(haloRing);
        }

        mixer = new THREE.AnimationMixer(root);
        for (const clip of tpl.animations) {
          actions[clip.name] = mixer.clipAction(clip);
        }
        activeMixers.push(mixer);
      } else {
        root = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.14, isDama ? 0.54 : 0.36, 16),
          isDama ? damaCrownGoldMat : (color === 'w' ? whitePieceMat : blackPieceMat)
        );
      }

      const worldPos = boardToWorld(r, c);
      root.position.copy(worldPos);
      const scale = isDama ? BOARD_SQ_SIZE * 1.05 : BOARD_SQ_SIZE;
      root.scale.set(scale, scale, scale);
      // White (at +Z, r=5,6,7) faces -Z (Math.PI); Black (at -Z, r=0,1,2) faces +Z (0)
      root.rotation.y = color === 'w' ? Math.PI : 0;
      scene.add(root);

      const pieceObj = {
        type: actualType,
        isDama,
        color,
        r,
        c,
        mesh: root,
        mixer,
        actions,
        currentAction: null,
        hasMoved: false
      };

      root.traverse((child) => {
        child.userData.piece = pieceObj;
      });

      playPieceClip(pieceObj, 'Idle', true, 0);
      return pieceObj;
    }

    // Exact per-piece Attack keyframe synchronization (24 fps Blender clips, zero overhead suspension freeze):
    const ATTACK_SYNC_PROFILES = {
      pawn:   { timeScale: 1.15, swingStartClip: 0.36, contactClip: 0.60, blowClip: 0.78, maxLunge: 0.095 },
      queen:  { timeScale: 1.08, swingStartClip: 0.35, contactClip: 0.58, blowClip: 0.77, maxLunge: 0.065 }
    };

    function playPieceClip(piece, clipKeyword, loop = true, fadeSeconds = 0.18) {
      if (!piece || !piece.actions) return;
      const lowerKw = clipKeyword.toLowerCase();
      const key = Object.keys(piece.actions).find((k) =>
        k.toLowerCase().includes(lowerKw)
      );
      if (!key) return;
      const nextAction = piece.actions[key];
      const isIdle = lowerKw.includes('idle');
      const isAttack = lowerKw.includes('attack');
      if (piece.currentAction && piece.currentAction !== nextAction) {
        piece.currentAction.fadeOut(fadeSeconds);
      }
      nextAction.reset();
      nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      nextAction.clampWhenFinished = !loop;
      if (isAttack) {
        const prof = ATTACK_SYNC_PROFILES[piece.type] || ATTACK_SYNC_PROFILES.queen;
        nextAction.timeScale = prof.timeScale;
      } else {
        nextAction.timeScale = 0.81;
      }
      if (isIdle && (!fadeSeconds || fadeSeconds <= 0.01)) {
        nextAction.time = ((piece.r * 5 + piece.c * 3) % 16) * 0.11;
      }
      nextAction.fadeIn(fadeSeconds).play();
      piece.currentAction = nextAction;
      if (piece.mixer) {
        piece.mixer.update(0.016);
      }
      renderer.shadowMap.needsUpdate = true;
    }

    function clearAllPieces() {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (boardState[r][c] && boardState[r][c].mesh) {
            scene.remove(boardState[r][c].mesh);
          }
          boardState[r][c] = null;
        }
      }
      activeMixers.length = 0;
    }

    // Estado de Captura Múltipla em Cadeia e Regra do Assopro (Dama Tradicional Brasileira)
    let activeChainSquare = null; // { r, c } quando a mesma pedra deve continuar saltando
    let chainCapturedSet = new Set(); // Conjunto de 'r,c' já saltados no turno atual
    let lastAssoproNotice = ''; // Aviso exibido quando uma pedra é assoprada (eliminada por não comer)
    let assopradaCount = 0;
    let assopradasHistory = [];

    function coordToSquareName(r, c) {
      const file = 'abcdefgh'[c] || '?';
      const rank = String(8 - r);
      return `${file}${rank}`;
    }

    // Scripted / Replay & Victory Banner State
    let scriptedGameActive = false;
    let scriptDeviated = false;
    let scriptMoves = [];
    let scriptCursor = 0;
    let moveHistory = [];
    let preMoveHighlightTask = null;
    let activeDuelSavedCam = null;
    let checkmateState = {
      active: false,
      bannerVisible: false,
      defeatedColor: null,
      winnerColor: null,
      kingFallAngleDeg: 0,
      phase: 'none'
    };

    function clearCheckmateSequence() {
      checkmateState.active = false;
      checkmateState.bannerVisible = false;
      checkmateState.defeatedColor = null;
      checkmateState.winnerColor = null;
      checkmateState.kingFallAngleDeg = 0;
      checkmateState.phase = 'none';
      const overlay = document.getElementById('checkmate-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
      }
    }

    function captureBoardSnapshot() {
      return {
        currentTurn,
        gameOver,
        capturedByWhite,
        capturedByBlack,
        assopradaCount,
        assopradasHistory: assopradasHistory.map((item) => ({ ...item })),
        activeChainSquare: activeChainSquare ? { ...activeChainSquare } : null,
        chainCapturedKeys: Array.from(chainCapturedSet),
        scriptCursor,
        scriptedGameActive,
        scriptDeviated,
        cells: boardState.map((row) =>
          row.map((p) => (p ? { type: p.type, color: p.color, hasMoved: Boolean(p.hasMoved) } : null))
        )
      };
    }

    function restoreBoardSnapshot(snap) {
      if (!snap) return false;
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      preMoveHighlightTask = null;
      activeMoveTweens.length = 0;
      clearCheckmateSequence();
      for (const d of shatterDebris) {
        if (d.mesh) scene.remove(d.mesh);
      }
      shatterDebris.length = 0;
      if (typeof clearMagicParticles === 'function') {
        clearMagicParticles();
      }
      impactFlashLight.intensity = 0;
      if (activeDuelSavedCam) {
        camera.position.copy(activeDuelSavedCam.pos);
        orbitControls.target.copy(activeDuelSavedCam.target);
        activeDuelSavedCam = null;
      }
      orbitControls.enabled = true;
      orbitControls.update();

      clearAllPieces();
      clearSquareHighlights();
      selectedSquare = null;
      validMoves = [];
      isAnimatingMove = false;
      currentTurn = snap.currentTurn;
      gameOver = snap.gameOver;
      capturedByWhite = snap.capturedByWhite;
      capturedByBlack = snap.capturedByBlack;
      assopradaCount = typeof snap.assopradaCount === 'number' ? snap.assopradaCount : 0;
      assopradasHistory = Array.isArray(snap.assopradasHistory)
        ? snap.assopradasHistory.map((item) => ({ ...item }))
        : [];
      activeChainSquare = snap.activeChainSquare ? { ...snap.activeChainSquare } : null;
      chainCapturedSet = new Set(snap.chainCapturedKeys || []);
      if (typeof snap.scriptCursor === 'number') {
        scriptCursor = snap.scriptCursor;
      }
      if (typeof snap.scriptedGameActive === 'boolean') {
        scriptedGameActive = snap.scriptedGameActive;
      }
      if (typeof snap.scriptDeviated === 'boolean') {
        scriptDeviated = snap.scriptDeviated;
      }

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = snap.cells[r][c];
          if (cell) {
            const inst = instantiatePiece(cell.type, cell.color, r, c);
            inst.hasMoved = Boolean(cell.hasMoved);
            boardState[r][c] = inst;
          }
        }
      }

      renderer.shadowMap.needsUpdate = true;
      updateTurnUI();
      if (typeof updateScriptBarUI === 'function') updateScriptBarUI();
      return true;
    }

    function resetChessBoard(orientCamera = true, preserveScript = false) {
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      preMoveHighlightTask = null;
      activeMoveTweens.length = 0;
      clearCheckmateSequence();
      if (activeDuelSavedCam) {
        camera.position.copy(activeDuelSavedCam.pos);
        orbitControls.target.copy(activeDuelSavedCam.target);
        activeDuelSavedCam = null;
      }
      orbitControls.enabled = true;
      clearAllPieces();
      if (typeof clearMagicParticles === 'function') {
        clearMagicParticles();
      }
      clearSquareHighlights();
      selectedSquare = null;
      validMoves = [];
      activeChainSquare = null;
      chainCapturedSet.clear();
      lastAssoproNotice = '';
      assopradaCount = 0;
      assopradasHistory = [];
      currentTurn = 'w';
      isAnimatingMove = false;
      gameOver = false;
      capturedByWhite = 0;
      capturedByBlack = 0;
      moveHistory = [];
      scriptDeviated = false;
      if (!preserveScript) {
        scriptCursor = 0;
      }

      // Posicionamento Oficial da Dama Brasileira (Tabuleiro 8x8 — 64 casas):
      // 12 pedras pretas nas casas escuras ((r + c) % 2 === 1) das linhas 0, 1 e 2
      // 12 pedras brancas nas casas escuras ((r + c) % 2 === 1) das linhas 5, 6 e 7
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if ((r + c) % 2 === 1) {
            if (r <= 2) {
              boardState[r][c] = instantiatePiece('pawn', 'b', r, c);
            } else if (r >= 5) {
              boardState[r][c] = instantiatePiece('pawn', 'w', r, c);
            }
          }
        }
      }

      if (orientCamera) {
        const viewSide = playerColor === 'b' ? 'b' : 'w';
        playerCamSide = viewSide;
        setActiveCamButton('btn-cam-player');
        setCameraForSide(viewSide, false);
      }

      renderer.shadowMap.needsUpdate = true;
      updateTurnUI();
      if (typeof updateScriptBarUI === 'function') updateScriptBarUI();
      maybeScheduleAIMove();
    }

    // =========================================================================
    // Motor Oficial de Regras — Damas Brasileiras (8x8, Captura Obrigatória & Lei da Maioria)
    // =========================================================================
    const DIAGONAL_DIRS = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ];

    function inBounds(r, c) {
      return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    /**
     * Busca recursiva (DFS) de todas as árvores de captura para uma peça em (r, c).
     * Regras Brasileiras:
     * - Pedra comum ('pawn'): captura para frente E para trás pulando 1 peça inimiga adjacente para a casa vazia imediatamente após.
     * - Dama ('queen'): captura para frente E para trás a qualquer distância na diagonal, pulando uma única peça inimiga e podendo pousar em qualquer casa vazia subsequente na mesma diagonal.
     * - Não é permitido saltar duas vezes sobre a mesma peça adversária no mesmo turno (forbiddenSet).
     * - Pedra comum que passa pela casa de coroação durante captura múltipla NÃO se torna Dama no meio da cadeia (só ao final do turno).
     */
    function getCaptureTreesForPiece(r, c, pieceType, pieceColor, board = boardState, forbiddenSet = new Set()) {
      const results = [];
      const movingPieceRef = board[r][c];

      if (pieceType === 'pawn') {
        for (const [dr, dc] of DIAGONAL_DIRS) {
          const er = r + dr;
          const ec = c + dc;
          const lr = r + dr * 2;
          const lc = c + dc * 2;
          if (!inBounds(lr, lc)) continue;

          const enemy = board[er][ec];
          if (!enemy || enemy.color === pieceColor) continue;
          const enemyKey = `${er},${ec}`;
          if (forbiddenSet.has(enemyKey)) continue;

          if (board[lr][lc] !== null) continue;

          // Simular salto mantendo a peça inimiga como obstáculo (regra que impede cruzar a mesma peça 2x)
          board[r][c] = null;
          board[lr][lc] = movingPieceRef || { type: pieceType, color: pieceColor };
          const nextForbidden = new Set(forbiddenSet);
          nextForbidden.add(enemyKey);

          const subTrees = getCaptureTreesForPiece(lr, lc, 'pawn', pieceColor, board, nextForbidden);

          board[lr][lc] = null;
          board[r][c] = movingPieceRef;

          let maxSub = 0;
          for (const st of subTrees) {
            if (st.maxChainCount > maxSub) maxSub = st.maxChainCount;
          }

          results.push({
            r: lr,
            c: lc,
            capture: true,
            capturedR: er,
            capturedC: ec,
            maxChainCount: 1 + maxSub,
            subTrees
          });
        }
      } else {
        // Dama ('queen'): corre a diagonal livremente para capturar
        for (const [dr, dc] of DIAGONAL_DIRS) {
          let step = 1;
          let er = -1;
          let ec = -1;

          while (inBounds(r + dr * step, c + dc * step)) {
            const sr = r + dr * step;
            const sc = c + dc * step;
            const occ = board[sr][sc];
            if (!occ) {
              step++;
              continue;
            }
            // Encontrou a primeira peça nesta diagonal
            if (occ.color !== pieceColor && !forbiddenSet.has(`${sr},${sc}`)) {
              er = sr;
              ec = sc;
            }
            break;
          }

          if (er === -1) continue;
          const enemyKey = `${er},${ec}`;

          // A Dama pode pousar em qualquer casa vazia após a peça capturada na mesma diagonal
          let landStep = 1;
          while (inBounds(er + dr * landStep, ec + dc * landStep)) {
            const lr = er + dr * landStep;
            const lc = ec + dc * landStep;
            if (board[lr][lc] !== null) break; // Bloqueado por outra peça após a vítima

            board[r][c] = null;
            board[lr][lc] = movingPieceRef || { type: 'queen', color: pieceColor };
            const nextForbidden = new Set(forbiddenSet);
            nextForbidden.add(enemyKey);

            const subTrees = getCaptureTreesForPiece(lr, lc, 'queen', pieceColor, board, nextForbidden);

            board[lr][lc] = null;
            board[r][c] = movingPieceRef;

            let maxSub = 0;
            for (const st of subTrees) {
              if (st.maxChainCount > maxSub) maxSub = st.maxChainCount;
            }

            results.push({
              r: lr,
              c: lc,
              capture: true,
              capturedR: er,
              capturedC: ec,
              maxChainCount: 1 + maxSub,
              subTrees
            });

            landStep++;
          }
        }
      }

      return results;
    }

    /**
     * Movimentos simples (sem captura) quando nenhuma captura está disponível no tabuleiro:
     * - Pedra comum ('pawn'): anda apenas 1 casa para a frente na diagonal (não pode voltar!).
     * - Dama ('queen'): corre quantas casas vazias quiser nas 4 diagonais.
     */
    function getSimpleMovesForPiece(r, c, board = boardState) {
      const piece = board[r][c];
      if (!piece) return [];
      const moves = [];
      const { type, color } = piece;

      if (type === 'pawn') {
        const forwardDr = color === 'w' ? -1 : 1;
        for (const dc of [-1, 1]) {
          const nr = r + forwardDr;
          const nc = c + dc;
          if (inBounds(nr, nc) && !board[nr][nc]) {
            moves.push({ r: nr, c: nc, capture: false, capturedR: -1, capturedC: -1, maxChainCount: 0 });
          }
        }
      } else {
        // Dama ('queen') corre toda a diagonal
        for (const [dr, dc] of DIAGONAL_DIRS) {
          let step = 1;
          while (inBounds(r + dr * step, c + dc * step)) {
            const nr = r + dr * step;
            const nc = c + dc * step;
            if (board[nr][nc]) break;
            moves.push({ r: nr, c: nc, capture: false, capturedR: -1, capturedC: -1, maxChainCount: 0 });
            step++;
          }
        }
      }
      return moves;
    }

    /**
     * Calcula o número máximo global de capturas possíveis para o jogador da vez (Lei da Maioria).
     */
    function getGlobalMaxCapturesForColor(color, board = boardState) {
      if (activeChainSquare && board === boardState) {
        const p = board[activeChainSquare.r]?.[activeChainSquare.c];
        if (!p || p.color !== color) return 0;
        const trees = getCaptureTreesForPiece(
          activeChainSquare.r,
          activeChainSquare.c,
          p.type,
          p.color,
          board,
          chainCapturedSet
        );
        let maxC = 0;
        for (const t of trees) {
          if (t.maxChainCount > maxC) maxC = t.maxChainCount;
        }
        return maxC;
      }

      let globalMax = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === color) {
            const trees = getCaptureTreesForPiece(r, c, p.type, p.color, board, new Set());
            for (const t of trees) {
              if (t.maxChainCount > globalMax) globalMax = t.maxChainCount;
            }
          }
        }
      }
      return globalMax;
    }

    function getPseudoMovesForPiece(r, c, board = boardState) {
      const piece = board[r][c];
      if (!piece) return [];
      const trees = getCaptureTreesForPiece(r, c, piece.type, piece.color, board, new Set());
      if (trees.length > 0) return trees;
      return getSimpleMovesForPiece(r, c, board);
    }

    function isKingInCheck() {
      // No xadrez havia xeque ao rei; na Dama Brasileira usamos este helper apenas como indicador de captura obrigatória
      return false;
    }

    /**
     * Lista todas as pedras da cor `color` que possuem captura disponível no tabuleiro atual.
     * Usado para aplicar a Regra do Assopro (Pedra Assoprada) caso o jogador mova sem comer.
     */
    function getPiecesWithCaptureAvailable(color, board = boardState) {
      const list = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === color) {
            const trees = getCaptureTreesForPiece(r, c, p.type, p.color, board, new Set());
            if (trees.length > 0) {
              let maxChain = 0;
              for (const t of trees) {
                if (t.maxChainCount > maxChain) maxChain = t.maxChainCount;
              }
              list.push({ r, c, maxChainCount: maxChain, trees });
            }
          }
        }
      }
      // Ordenar pela maior cadeia de captura primeiro
      list.sort((a, b) => b.maxChainCount - a.maxChainCount);
      return list;
    }

    /**
     * Retorna os movimentos disponíveis para a peça em (r, c).
     * Pela Regra do Assopro (Dama Tradicional Brasileira):
     * - O jogador pode escolher tanto capturar quanto mover outra pedra normalmente.
     * - Porém, se houver captura disponível e ele não comer (mover outra pedra ou andar sem capturar),
     *   a pedra que deixou de comer é "assoprada" (eliminada do jogo)!
     */
    function getLegalMovesForPiece(r, c, board = boardState) {
      const piece = board[r][c];
      if (!piece) return [];

      // Se estamos no meio de uma captura múltipla em cadeia já iniciada, a mesma pedra conclui o salto
      if (activeChainSquare && board === boardState) {
        if (r !== activeChainSquare.r || c !== activeChainSquare.c) {
          return [];
        }
        const trees = getCaptureTreesForPiece(r, c, piece.type, piece.color, board, chainCapturedSet);
        let maxChain = 0;
        for (const t of trees) {
          if (t.maxChainCount > maxChain) maxChain = t.maxChainCount;
        }
        return trees.filter((t) => t.maxChainCount === maxChain);
      }

      const captureMoves = getCaptureTreesForPiece(r, c, piece.type, piece.color, board, new Set());
      const simpleMoves = getSimpleMovesForPiece(r, c, board);
      return [...captureMoves, ...simpleMoves];
    }

    function getAllLegalMoves(color, board = boardState) {
      const all = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === color) {
            const moves = getLegalMovesForPiece(r, c, board);
            for (const m of moves) {
              all.push({
                fromR: r,
                fromC: c,
                toR: m.r,
                toC: m.c,
                capture: m.capture,
                capturedR: m.capturedR,
                capturedC: m.capturedC,
                maxChainCount: m.maxChainCount
              });
            }
          }
        }
      }
      return all;
    }

    // =========================================================================
    // Square Highlights (Anéis Dourados, Destinos Simples em Azul e Capturas em Carmesim)
    // =========================================================================
    function clearSquareHighlights() {
      while (squareHighlightsGroup.children.length > 0) {
        squareHighlightsGroup.remove(squareHighlightsGroup.children[0]);
      }
    }

    function showSquareHighlights(r, c, moves) {
      clearSquareHighlights();
      const selGeo = new THREE.RingGeometry(0.115, 0.155, 32);
      selGeo.rotateX(-Math.PI / 2);
      const selMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e, side: THREE.DoubleSide });
      const selMesh = new THREE.Mesh(selGeo, selMat);
      const selPos = boardToWorld(r, c);
      selMesh.position.set(selPos.x, BOARD_SURFACE_Y + 0.01, selPos.z);
      squareHighlightsGroup.add(selMesh);

      for (const m of moves) {
        const pos = boardToWorld(m.r, m.c);
        if (m.capture) {
          // Anel carmesim na casa de pouso do salto
          const capGeo = new THREE.RingGeometry(0.12, 0.16, 32);
          capGeo.rotateX(-Math.PI / 2);
          const capMat = new THREE.MeshBasicMaterial({ color: 0xe63946, side: THREE.DoubleSide });
          const capMesh = new THREE.Mesh(capGeo, capMat);
          capMesh.position.set(pos.x, BOARD_SURFACE_Y + 0.012, pos.z);
          squareHighlightsGroup.add(capMesh);

          // Ponto central dourado na casa de pouso e anel de alerta sobre a peça adversária que será comida
          const centerGeo = new THREE.CircleGeometry(0.065, 24);
          centerGeo.rotateX(-Math.PI / 2);
          const centerMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e, side: THREE.DoubleSide });
          const centerMesh = new THREE.Mesh(centerGeo, centerMat);
          centerMesh.position.set(pos.x, BOARD_SURFACE_Y + 0.013, pos.z);
          squareHighlightsGroup.add(centerMesh);

          if (typeof m.capturedR === 'number' && m.capturedR >= 0) {
            const vicPos = boardToWorld(m.capturedR, m.capturedC);
            const vicGeo = new THREE.RingGeometry(0.13, 0.165, 32);
            vicGeo.rotateX(-Math.PI / 2);
            const vicMat = new THREE.MeshBasicMaterial({
              color: 0xe63946,
              transparent: true,
              opacity: 0.72,
              side: THREE.DoubleSide
            });
            const vicMesh = new THREE.Mesh(vicGeo, vicMat);
            vicMesh.position.set(vicPos.x, BOARD_SURFACE_Y + 0.011, vicPos.z);
            squareHighlightsGroup.add(vicMesh);
          }
        } else {
          const dotGeo = new THREE.CircleGeometry(0.06, 24);
          dotGeo.rotateX(-Math.PI / 2);
          const dotMat = new THREE.MeshBasicMaterial({
            color: 0x4ea8de,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
          });
          const dotMesh = new THREE.Mesh(dotGeo, dotMat);
          dotMesh.position.set(pos.x, BOARD_SURFACE_Y + 0.01, pos.z);
          squareHighlightsGroup.add(dotMesh);
        }
      }
    }

    // =========================================================================
    // Stone Shatter Debris Physics, 3D Magic Dust & Golden Sparks Particle System
    // =========================================================================
    const sharedShardGeo = new THREE.DodecahedronGeometry(1, 0);
    const magicParticleSystems = [];

    function createMagicSparkTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
        grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.22, 'rgba(255, 240, 175, 0.95)');
        grad.addColorStop(0.52, 'rgba(245, 195, 68, 0.48)');
        grad.addColorStop(1.0, 'rgba(212, 140, 20, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        // Brilho estelar cruzado sutil no núcleo da fagulha
        ctx.strokeStyle = 'rgba(255, 252, 230, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(32, 8);
        ctx.lineTo(32, 56);
        ctx.moveTo(8, 32);
        ctx.lineTo(56, 32);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    }

    const magicSparkTexture = createMagicSparkTexture();
    const shockwaveRingGeo = new THREE.RingGeometry(0.05, 0.13, 36);
    shockwaveRingGeo.rotateX(-Math.PI / 2);
    const sparkStreakGeo = new THREE.ConeGeometry(0.012, 0.11, 6);
    sparkStreakGeo.rotateX(Math.PI / 2);
    const UP_AXIS = new THREE.Vector3(0, 0, 1);

    function clearMagicParticles() {
      for (let i = magicParticleSystems.length - 1; i >= 0; i--) {
        const sys = magicParticleSystems[i];
        if (sys.emitterGroup) {
          scene.remove(sys.emitterGroup);
          sys.emitterGroup.traverse((child) => {
            if (child.geometry && child.geometry !== shockwaveRingGeo && child.geometry !== sparkStreakGeo) {
              child.geometry.dispose?.();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose?.());
              } else {
                child.material.dispose?.();
              }
            }
          });
        }
        if (sys.points) {
          scene.remove(sys.points);
          sys.points.geometry?.dispose();
          sys.points.material?.dispose();
        }
        if (sys.shockwave) {
          scene.remove(sys.shockwave);
          sys.shockwave.material?.dispose();
        }
      }
      magicParticleSystems.length = 0;
    }

    /**
     * Cria um grupo 3D customizado de emissores de luz (`THREE.Group` com `PointLight`s móveis e halos)
     * e faíscas douradas balísticas sincronizadas com os vetores de estilhaçamento da pedra no local exato da captura.
     */
    function spawnCaptureMagicParticles(worldPos, capturedColor = 'b', sharedShardVectors = [], impactDir = null) {
      const emitterGroup = new THREE.Group();
      emitterGroup.name = 'CaptureLightAndSparkEmitterGroup';
      emitterGroup.position.copy(worldPos);
      scene.add(emitterGroup);

      // 1. Grupo de Emissores de Luz Dinâmicos no ponto exato da captura
      // Emissor central de ruptura da pedra
      const coreLight = new THREE.PointLight(0xffdf73, 9.5, 2.9, 1.7);
      coreLight.position.set(0, 0.16, 0);
      emitterGroup.add(coreLight);

      const coreHaloMat = new THREE.SpriteMaterial({
        map: magicSparkTexture,
        color: 0xffe885,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const coreHalo = new THREE.Sprite(coreHaloMat);
      coreHalo.position.set(0, 0.16, 0);
      coreHalo.scale.set(0.52, 0.52, 1);
      emitterGroup.add(coreHalo);

      // Emissores móveis de luz dourada/âmbar que acompanham os vetores principais dos estilhaços da pedra
      const lightEmitters = [];
      const emitterColors = [0xfff3b0, 0xf5d76e, 0xffb703, 0xfb8500];
      for (let eIdx = 0; eIdx < 4; eIdx++) {
        const eColor = emitterColors[eIdx % emitterColors.length];
        const ptLight = new THREE.PointLight(eColor, 4.2, 1.55, 1.8);
        const spMat = new THREE.SpriteMaterial({
          map: magicSparkTexture,
          color: eColor,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const glowSprite = new THREE.Sprite(spMat);
        glowSprite.scale.set(0.24, 0.24, 1);
        ptLight.add(glowSprite);

        // Coordenar direção com os fragmentos físicos da pedra estilhaçada
        const refVec = sharedShardVectors[eIdx];
        const angle = (eIdx / 4) * Math.PI * 2 + Math.random() * 0.45;
        const vel = refVec
          ? refVec.clone().multiplyScalar(0.92)
          : new THREE.Vector3(
              Math.cos(angle) * (0.95 + Math.random() * 0.75),
              1.15 + Math.random() * 0.95,
              Math.sin(angle) * (0.95 + Math.random() * 0.75)
            );

        ptLight.position.set(
          Math.cos(angle) * 0.05,
          0.12 + Math.random() * 0.1,
          Math.sin(angle) * 0.05
        );
        emitterGroup.add(ptLight);

        lightEmitters.push({
          light: ptLight,
          sprite: glowSprite,
          vel,
          baseIntensity: 4.2,
          phase: Math.random() * Math.PI * 2
        });
      }

      // 2. Faíscas Douradas 3D Alongadas (Streaks) coordenadas com os fragmentos da pedra
      const sparkStreaks = [];
      const streakCount = 18;
      for (let sIdx = 0; sIdx < streakCount; sIdx++) {
        const streakMat = new THREE.MeshBasicMaterial({
          color: sIdx % 3 === 0 ? 0xfff8d6 : sIdx % 2 === 0 ? 0xf5d76e : 0xffaa00,
          transparent: true,
          opacity: 0.96,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const streakMesh = new THREE.Mesh(sparkStreakGeo, streakMat);
        const shardRef = sharedShardVectors[sIdx % Math.max(1, sharedShardVectors.length)];
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2.1;
        const vel = shardRef
          ? new THREE.Vector3(
              shardRef.x * (0.85 + Math.random() * 0.5),
              shardRef.y * (0.9 + Math.random() * 0.45),
              shardRef.z * (0.85 + Math.random() * 0.5)
            )
          : new THREE.Vector3(
              Math.cos(angle) * speed + (impactDir ? impactDir.x * 0.55 : 0),
              1.1 + Math.random() * 2.1,
              Math.sin(angle) * speed + (impactDir ? impactDir.z * 0.55 : 0)
            );

        streakMesh.position.set(
          (Math.random() - 0.5) * 0.12,
          0.08 + Math.random() * 0.22,
          (Math.random() - 0.5) * 0.12
        );
        emitterGroup.add(streakMesh);
        sparkStreaks.push({
          mesh: streakMesh,
          vel,
          life: 0.75 + Math.random() * 0.65,
          maxLife: 1.4
        });
      }

      // 3. Nuvem de Partículas 3D Customizada (128 partículas: Faíscas Douradas + Poeira Mística + Brasa de Impacto)
      const count = 128;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const baseColors = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);
      const kinds = new Uint8Array(count); // 0 = faísca dourada balística, 1 = vórtice de poeira luminosa, 2 = brasa acoplada aos estilhaços
      const phases = new Float32Array(count);
      const lifetimes = new Float32Array(count);

      const palette = [
        new THREE.Color(0xfff8dc), // Ouro branco incandescente
        new THREE.Color(0xf5d76e), // Ouro real brilhante
        new THREE.Color(0xffb703), // Âmbar dourado
        new THREE.Color(0xfb8500), // Brasa mágica
        capturedColor === 'w' ? new THREE.Color(0xfff0c2) : new THREE.Color(0xffd166)
      ];

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const kind = i < 64 ? 0 : i < 100 ? 1 : 2;
        kinds[i] = kind;
        phases[i] = Math.random() * Math.PI * 2;

        const angle = Math.random() * Math.PI * 2;
        const radius = (kind === 1 ? 0.04 : 0.015) + Math.random() * (kind === 1 ? 0.16 : 0.085);
        positions[i3] = worldPos.x + Math.cos(angle) * radius;
        positions[i3 + 1] = worldPos.y + 0.05 + Math.random() * 0.25;
        positions[i3 + 2] = worldPos.z + Math.sin(angle) * radius;

        if (kind === 1) {
          // Poeira mágica ascendente em espiral ao redor da casa capturada
          const outSpeed = 0.20 + Math.random() * 0.58;
          velocities[i3] = Math.cos(angle) * outSpeed;
          velocities[i3 + 1] = 0.52 + Math.random() * 1.05;
          velocities[i3 + 2] = Math.sin(angle) * outSpeed;
          lifetimes[i] = 1.4 + Math.random() * 0.75;
        } else if (kind === 2 && sharedShardVectors.length > 0) {
          // Brasas douradas sincronizadas diretamente com os vetores dos fragmentos de pedra estilhaçada
          const sv = sharedShardVectors[i % sharedShardVectors.length];
          velocities[i3] = sv.x * (0.92 + Math.random() * 0.25);
          velocities[i3 + 1] = sv.y * (0.95 + Math.random() * 0.25);
          velocities[i3 + 2] = sv.z * (0.92 + Math.random() * 0.25);
          lifetimes[i] = 1.05 + Math.random() * 0.7;
        } else {
          // Faíscas douradas rápidas com impulso direcional do golpe
          const outSpeed = 0.95 + Math.random() * 2.35;
          const biasX = impactDir ? impactDir.x * 0.65 : 0;
          const biasZ = impactDir ? impactDir.z * 0.65 : 0;
          velocities[i3] = Math.cos(angle) * outSpeed + biasX;
          velocities[i3 + 1] = 1.05 + Math.random() * 2.4;
          velocities[i3 + 2] = Math.sin(angle) * outSpeed + biasZ;
          lifetimes[i] = 0.9 + Math.random() * 0.8;
        }

        const c = palette[Math.floor(Math.random() * palette.length)];
        baseColors[i3] = c.r;
        baseColors[i3 + 1] = c.g;
        baseColors[i3 + 2] = c.b;
        colors[i3] = c.r;
        colors[i3 + 1] = c.g;
        colors[i3 + 2] = c.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 0.098,
        map: magicSparkTexture,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });

      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      scene.add(points);

      // Onda de choque circular dourada rente à casa exata da captura
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf5d76e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const shockwave = new THREE.Mesh(shockwaveRingGeo, ringMat);
      shockwave.position.set(worldPos.x, BOARD_SURFACE_Y + 0.014, worldPos.z);
      shockwave.scale.setScalar(0.55);
      scene.add(shockwave);

      magicParticleSystems.push({
        emitterGroup,
        coreLight,
        coreHalo,
        lightEmitters,
        sparkStreaks,
        points,
        shockwave,
        origin: worldPos.clone(),
        positions,
        colors,
        baseColors,
        velocities,
        kinds,
        phases,
        lifetimes,
        count,
        elapsed: 0,
        maxLife: 2.2
      });
    }

    // =========================================================================
    // Procedural Web Audio API Sound Engine (Pedra, Captura, Fagulhas, Coroação e Catedral)
    // =========================================================================
    let soundEnabled = true;
    let audioCtx = null;
    let noiseBuffer = null;
    let ambienceStarted = false;
    let ambienceGainNode = null;

    function getAudioContext() {
      if (!soundEnabled) return null;
      if (!audioCtx && typeof window !== 'undefined') {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          try {
            audioCtx = new Ctx();
          } catch (e) {
            return null;
          }
        }
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      if (audioCtx && !noiseBuffer) {
        const sr = audioCtx.sampleRate;
        noiseBuffer = audioCtx.createBuffer(1, sr * 2, sr);
        const data = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          // Ruído marrom/rosa filtrado para textura realista de pedra e fogo
          data[i] = (lastOut + 0.045 * white) / 1.045;
          lastOut = data[i];
        }
      }
      if (audioCtx && !ambienceStarted && audioCtx.state === 'running') {
        startCathedralAmbience();
      }
      return audioCtx;
    }

    function startCathedralAmbience() {
      if (!audioCtx || ambienceStarted) return;
      try {
        ambienceStarted = true;
        const masterAmb = audioCtx.createGain();
        masterAmb.gain.value = soundEnabled ? 0.032 : 0.0;
        masterAmb.connect(audioCtx.destination);
        ambienceGainNode = masterAmb;

        // Ressonância acústica grave do santuário gótico (D2 + A2 suave)
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.value = 73.42; // D2
        osc2.frequency.value = 110.0; // A2

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 165;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterAmb);
        osc1.start();
        osc2.start();
      } catch (e) {}
    }

    function toggleSound(forceState) {
      soundEnabled = typeof forceState === 'boolean' ? forceState : !soundEnabled;
      const btnSound = document.getElementById('btn-sound-toggle');
      if (btnSound) {
        btnSound.textContent = soundEnabled ? 'Som: Ligado [M]' : 'Som: Mudo [M]';
        btnSound.classList.toggle('active', soundEnabled);
      }
      if (soundEnabled) {
        const ctx = getAudioContext();
        if (ambienceGainNode && ctx) {
          ambienceGainNode.gain.setTargetAtTime(0.032, ctx.currentTime, 0.15);
        }
        playSelectSound(false);
      } else if (ambienceGainNode && audioCtx) {
        ambienceGainNode.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.08);
      }
      return soundEnabled;
    }

    // Desbloquear AudioContext no primeiro clique/toque do jogador
    window.addEventListener(
      'pointerdown',
      () => {
        if (soundEnabled) getAudioContext();
      },
      { passive: true }
    );

    function playSelectSound(isDama = false) {
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        // Toque seco em pedra esculpida
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isDama ? 'triangle' : 'sine';
        const baseFreq = isDama ? 520 : 310;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.065);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.095);

        // Harmônico dourado extra ao selecionar uma Dama coroada
        if (isDama) {
          const bell = ctx.createOscillator();
          const bellGain = ctx.createGain();
          bell.type = 'sine';
          bell.frequency.setValueAtTime(1046.5, now); // C6
          bellGain.gain.setValueAtTime(0.07, now);
          bellGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);
          bell.connect(bellGain);
          bellGain.connect(ctx.destination);
          bell.start(now);
          bell.stop(now + 0.29);
        }
      } catch (e) {}
    }

    function playStoneSlideSound(durationSec = 0.55, isDama = false) {
      const ctx = getAudioContext();
      if (!ctx || !noiseBuffer) return;
      try {
        const now = ctx.currentTime;
        const dur = Math.max(0.25, Math.min(1.4, durationSec));
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        src.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isDama ? 420 : 320, now);
        filter.frequency.linearRampToValueAtTime(isDama ? 540 : 390, now + dur * 0.6);
        filter.frequency.linearRampToValueAtTime(260, now + dur);
        filter.Q.value = 2.4;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.06);
        gain.gain.setValueAtTime(0.16, now + dur * 0.75);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + dur + 0.02);
      } catch (e) {}
    }

    function playStoneSettleSound(isDama = false) {
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        // Impacto grave da base de pedra pousando no altar
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isDama ? 145 : 125, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } catch (e) {}
    }

    function playWeaponSwingSound() {
      const ctx = getAudioContext();
      if (!ctx || !noiseBuffer) return;
      try {
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(280, now);
        filter.frequency.exponentialRampToValueAtTime(1150, now + 0.12);
        filter.frequency.exponentialRampToValueAtTime(340, now + 0.24);
        filter.Q.value = 1.8;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.26);
      } catch (e) {}
    }

    function playStoneShatterAndSparksSound() {
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;

        // 1. Impacto sísmico da pedra sendo destruída
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(110, now);
        subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.32);
        subGain.gain.setValueAtTime(0.45, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.36);

        // 2. Estalo de rocha rachando + fragmentos quicando no tabuleiro
        if (noiseBuffer) {
          for (let b = 0; b < 5; b++) {
            const delay = b * 0.055 + (Math.random() * 0.025);
            const src = ctx.createBufferSource();
            src.buffer = noiseBuffer;

            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(550 + b * 240, now + delay);
            bp.Q.value = 2.2;

            const g = ctx.createGain();
            const amp = 0.28 * Math.pow(0.68, b);
            g.gain.setValueAtTime(amp, now + delay);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.14);

            src.connect(bp);
            bp.connect(g);
            g.connect(ctx.destination);
            src.start(now + delay);
            src.stop(now + delay + 0.15);
          }
        }

        // 3. Cintilação mágica das fagulhas douradas e poeira mística (arpejo cristalino agudo)
        const sparkFreqs = [1174.66, 1479.98, 1760.0, 2217.46, 2637.02]; // D6, F#6, A6, C#7, E7
        for (let s = 0; s < sparkFreqs.length; s++) {
          const t0 = now + 0.03 + s * 0.048;
          const sparkOsc = ctx.createOscillator();
          const sparkGain = ctx.createGain();
          sparkOsc.type = 'sine';
          sparkOsc.frequency.setValueAtTime(sparkFreqs[s], t0);
          sparkOsc.frequency.exponentialRampToValueAtTime(sparkFreqs[s] * 1.03, t0 + 0.28);

          sparkGain.gain.setValueAtTime(0.055 * Math.pow(0.85, s), t0);
          sparkGain.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.32);

          sparkOsc.connect(sparkGain);
          sparkGain.connect(ctx.destination);
          sparkOsc.start(t0);
          sparkOsc.stop(t0 + 0.34);
        }
      } catch (e) {}
    }

    function playCoronationSound() {
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        // Acorde triunfal dourado quando a Pedra se transforma na Rainha (Dama)
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
        notes.forEach((freq, idx) => {
          const t0 = now + idx * 0.075;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, t0);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.11, t0 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.95);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.98);
        });
      } catch (e) {}
    }

    function playVictorySound() {
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        // Fanfarra solene de vitória na catedral
        const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
        chord.forEach((freq, idx) => {
          const t0 = now + idx * 0.09;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx < 2 ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(freq, t0);

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 1800;

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(idx < 2 ? 0.06 : 0.095, t0 + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.65);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.7);
        });
      } catch (e) {}
    }

    function playAssoproSound() {
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        // Rajada de sopro de vento ("assopro") + dissipação mágica
        if (noiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(220, now);
          filter.frequency.exponentialRampToValueAtTime(980, now + 0.18);
          filter.frequency.exponentialRampToValueAtTime(190, now + 0.52);
          filter.Q.value = 1.6;

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.36, now + 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

          src.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          src.start(now);
          src.stop(now + 0.56);
        }

        // Acorde descendente de penalidade ("pedra assoprada")
        const tones = [587.33, 440.0, 329.63]; // D5 -> A4 -> E4
        tones.forEach((freq, i) => {
          const t0 = now + i * 0.08;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t0);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.88, t0 + 0.22);
          g.gain.setValueAtTime(0.09, t0);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.25);
        });
      } catch (e) {}
    }

    function assoprarPedra(r, c) {
      const blownPiece = boardState[r]?.[c];
      if (!blownPiece) return false;
      const worldPos = boardToWorld(r, c);
      if (blownPiece.mesh) {
        scene.remove(blownPiece.mesh);
      }
      boardState[r][c] = null;
      if (blownPiece.color === 'w') {
        capturedByBlack += 1;
      } else {
        capturedByWhite += 1;
      }
      assopradaCount += 1;
      const sqName = coordToSquareName(r, c);
      const sideLabel = blownPiece.color === 'w' ? 'Branca' : 'Preta';
      const pieceLabel = blownPiece.type === 'queen' ? 'Dama' : 'Pedra';
      const blownEntry = {
        id: assopradaCount,
        moveNumber: moveHistory.length,
        color: blownPiece.color,
        pieceType: blownPiece.type,
        pieceLabel: `${pieceLabel} ${sideLabel}`,
        square: sqName,
        r,
        c
      };
      assopradasHistory.push(blownEntry);
      if (moveHistory.length > 0) {
        const lastEntry = moveHistory[moveHistory.length - 1];
        if (lastEntry && lastEntry.move) {
          lastEntry.move.assoprada = blownEntry;
        }
      }
      lastAssoproNotice = `💨 ${pieceLabel} ${sideLabel} (${sqName}) Assoprada! (Eliminada por não comer)`;
      spawnStoneShatter(worldPos, blownPiece.color);
      playAssoproSound();
      return true;
    }

    function spawnStoneShatter(worldPos, color, impactDir = null) {
      const mat = color === 'w' ? whitePieceMat : blackPieceMat;
      const sharedShardVectors = [];
      for (let i = 0; i < 34; i++) {
        const sz = 0.024 + Math.random() * 0.048;
        // Alguns fragmentos recebem veio dourado incandescente para coordenar com as faíscas
        const useGoldVein = i % 7 === 0;
        const frag = new THREE.Mesh(sharedShardGeo, useGoldVein ? damaCrownGoldMat : mat);
        frag.scale.setScalar(sz);
        frag.position.set(
          worldPos.x + (Math.random() - 0.5) * 0.16,
          worldPos.y + 0.10 + Math.random() * 0.28,
          worldPos.z + (Math.random() - 0.5) * 0.16
        );
        frag.castShadow = true;
        scene.add(frag);

        const dirBiasX = impactDir ? impactDir.x * (0.45 + Math.random() * 0.65) : 0;
        const dirBiasZ = impactDir ? impactDir.z * (0.45 + Math.random() * 0.65) : 0;
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 2.2 + dirBiasX,
          1.25 + Math.random() * 2.05,
          (Math.random() - 0.5) * 2.2 + dirBiasZ
        );
        sharedShardVectors.push(vel.clone());

        shatterDebris.push({
          mesh: frag,
          baseScale: sz,
          vel,
          rotVel: new THREE.Vector3(
            Math.random() * 9,
            Math.random() * 9,
            Math.random() * 9
          ),
          life: 2.2
        });
      }
      // Disparar o grupo de emissores de luz e faíscas douradas sincronizado com os vetores de estilhaçamento
      spawnCaptureMagicParticles(worldPos, color, sharedShardVectors, impactDir);
      playStoneShatterAndSparksSound();
      impactFlashLight.position.set(worldPos.x, worldPos.y + 0.4, worldPos.z);
      impactFlashLight.intensity = 7.8;
    }

    function spawnCoronationBurst(worldPos) {
      spawnCaptureMagicParticles(worldPos, 'w');
      playCoronationSound();
      for (let i = 0; i < 20; i++) {
        const sz = 0.018 + Math.random() * 0.028;
        const spark = new THREE.Mesh(sharedShardGeo, damaCrownGoldMat);
        spark.scale.setScalar(sz);
        spark.position.set(
          worldPos.x + (Math.random() - 0.5) * 0.20,
          worldPos.y + 0.08 + Math.random() * 0.35,
          worldPos.z + (Math.random() - 0.5) * 0.20
        );
        scene.add(spark);
        shatterDebris.push({
          mesh: spark,
          baseScale: sz,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 1.6,
            1.5 + Math.random() * 1.8,
            (Math.random() - 0.5) * 1.6
          ),
          rotVel: new THREE.Vector3(
            Math.random() * 10,
            Math.random() * 10,
            Math.random() * 10
          ),
          life: 1.6
        });
      }
      impactFlashLight.position.set(worldPos.x, worldPos.y + 0.5, worldPos.z);
      impactFlashLight.intensity = 8.5;
    }

    // =========================================================================
    // Concrete 3D Piece Dimensions & Anti-Clipping Collision Constants
    // =========================================================================
    const PIECE_HEIGHTS = {
      pawn: 0.36,
      queen: 0.55
    };
    const MIN_PIECE_SEP = 0.318;
    const MELEE_STANDOFF = 0.34;

    // =========================================================================
    // Smooth Jump-Capture Camera & Move Execution Choreography (Damas Brasileiras)
    // =========================================================================
    function findCapturedSquareAlongDiagonal(fromR, fromC, toR, toC, attackerColor) {
      const dr = Math.sign(toR - fromR);
      const dc = Math.sign(toC - fromC);
      if (dr === 0 || dc === 0 || Math.abs(toR - fromR) !== Math.abs(toC - fromC)) {
        return null;
      }
      const steps = Math.abs(toR - fromR);
      for (let s = 1; s < steps; s++) {
        const cr = fromR + dr * s;
        const cc = fromC + dc * s;
        const p = boardState[cr]?.[cc];
        if (p && p.color !== attackerColor) {
          return { r: cr, c: cc };
        }
      }
      return null;
    }

    function executeChessMove(fromR, fromC, toR, toC, options = {}) {
      const piece = boardState[fromR]?.[fromC];
      if (!piece || isAnimatingMove || gameOver) return false;
      if (piece.color !== currentTurn) return false;

      // Na Dama, a casa de destino (toR, toC) deve estar sempre vazia
      const targetOnDest = boardState[toR]?.[toC];
      if (targetOnDest) {
        return false;
      }

      let matchedLegal = null;
      const legalForPiece = getLegalMovesForPiece(fromR, fromC);
      matchedLegal = legalForPiece.find((m) => m.r === toR && m.c === toC) || null;

      if (!options.fromRemote && !matchedLegal) {
        return false;
      }

      // Antes de executar o movimento, verificar quais pedras tinham captura disponível (Regra do Assopro)
      const preMoveCapturers = !activeChainSquare
        ? getPiecesWithCaptureAvailable(piece.color, boardState)
        : [];
      lastAssoproNotice = '';

      // Identificar a peça adversária saltada/capturada na diagonal entre (fromR, fromC) e (toR, toC)
      let capCoord = null;
      if (matchedLegal && matchedLegal.capture && matchedLegal.capturedR >= 0) {
        capCoord = { r: matchedLegal.capturedR, c: matchedLegal.capturedC };
      } else {
        capCoord = findCapturedSquareAlongDiagonal(fromR, fromC, toR, toC, piece.color);
      }

      const captured = capCoord ? boardState[capCoord.r]?.[capCoord.c] : null;
      const isCapture = Boolean(captured);

      if (preMoveHighlightTask) {
        preMoveHighlightTask = null;
      }

      // Salvar snapshot para desfazer/voltar passo e alimentar o histórico lateral
      moveHistory.push({
        snapshot: captureBoardSnapshot(),
        move: {
          moveNumber: moveHistory.length + 1,
          color: piece.color,
          pieceType: piece.type,
          fromR,
          fromC,
          toR,
          toC,
          fromSq: coordToSquareName(fromR, fromC),
          toSq: coordToSquareName(toR, toC),
          capture: isCapture,
          capturedR: capCoord ? capCoord.r : -1,
          capturedC: capCoord ? capCoord.c : -1,
          capturedSq: capCoord ? coordToSquareName(capCoord.r, capCoord.c) : null,
          crowned: false,
          assoprada: null
        }
      });

      if (options.fromScript) {
        scriptCursor = Math.min(scriptMoves.length, scriptCursor + 1);
      } else if (!scriptDeviated && scriptCursor < scriptMoves.length) {
        const expected = scriptMoves[scriptCursor];
        if (
          expected &&
          expected.fromR === fromR &&
          expected.fromC === fromC &&
          expected.toR === toR &&
          expected.toC === toC
        ) {
          scriptCursor = Math.min(scriptMoves.length, scriptCursor + 1);
        } else {
          scriptDeviated = true;
          scriptedGameActive = false;
        }
      } else if (scriptMoves.length > 0) {
        scriptDeviated = true;
        scriptedGameActive = false;
      }
      if (typeof updateScriptBarUI === 'function') updateScriptBarUI();

      isAnimatingMove = true;
      activeCamTransition = null;
      clearSquareHighlights();
      selectedSquare = null;
      validMoves = [];

      if (gameMode === 'multi' && roomCode && !options.fromRemote) {
        sendMultiplayerMove({
          playerToken,
          color: piece.color,
          from: { r: fromR, c: fromC },
          to: { r: toR, c: toC },
          promotion: 'queen'
        });
      }

      const startPos = boardToWorld(fromR, fromC);
      const endPos = boardToWorld(toR, toC);
      const victimPos = isCapture && capCoord ? boardToWorld(capCoord.r, capCoord.c) : endPos.clone();
      const dx = endPos.x - startPos.x;
      const dz = endPos.z - startPos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const moveHeading = Math.atan2(dx, dz);
      piece.mesh.rotation.y = moveHeading;
      playPieceClip(piece, 'Move', true, 0.10);

      // A peça inimiga que será saltada gira para encarar o atacante
      if (isCapture && captured && captured.mesh) {
        captured.mesh.rotation.y = Math.atan2(-dx, -dz);
      }

      // Posição de golpe: imediatamente antes da peça adversária saltada (victimPos)
      const distToVictim = startPos.distanceTo(victimPos);
      const stopOffset = isCapture ? Math.min(MELEE_STANDOFF, distToVictim * 0.78) : 0;
      const strikePos = isCapture
        ? new THREE.Vector3(
            victimPos.x - dirX * stopOffset,
            BOARD_SURFACE_Y,
            victimPos.z - dirZ * stopOffset
          )
        : endPos.clone();

      // Coletar todas as demais peças no tabuleiro para evitar colisão
      const bystanders = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const other = boardState[r][c];
          if (other && other !== piece && other !== captured && other.mesh) {
            bystanders.push({
              piece: other,
              homePos: boardToWorld(r, c),
              height: PIECE_HEIGHTS[other.type] || 0.45
            });
          }
        }
      }

      const segDx = (isCapture ? strikePos.x : endPos.x) - startPos.x;
      const segDz = (isCapture ? strikePos.z : endPos.z) - startPos.z;
      const segLen = Math.hypot(segDx, segDz) || 0.001;
      const segUx = segDx / segLen;
      const segUz = segDz / segLen;
      const segPerpX = -segUz;
      const segPerpZ = segUx;

      function resetBystandersToHome() {
        for (const b of bystanders) {
          b.piece.mesh.position.copy(b.homePos);
        }
      }

      const isDiagonalSlide =
        Math.abs(toR - fromR) === Math.abs(toC - fromC) &&
        Math.abs(toR - fromR) >= 1;

      function applyConcreteTrajectory(u, fromVec, toVec) {
        const ease = isCapture ? (0.28 * u + 0.72 * easeInOutCubic(u)) : easeInOutCubic(u);
        let bx = fromVec.x + (toVec.x - fromVec.x) * ease;
        let bz = fromVec.z + (toVec.z - fromVec.z) * ease;
        const by = BOARD_SURFACE_Y;
        const archSin = Math.sin(u * Math.PI);

        const effectiveMinSep = isDiagonalSlide ? 0.262 : MIN_PIECE_SEP;
        for (const b of bystanders) {
          const hx = b.homePos.x;
          const hz = b.homePos.z;
          const dHomeX = bx - hx;
          const dHomeZ = bz - hz;
          const dHome = Math.hypot(dHomeX, dHomeZ);

          if (by >= BOARD_SURFACE_Y + b.height + 0.025) {
            b.piece.mesh.position.copy(b.homePos);
            continue;
          }

          if (dHome < 0.36 && dHome > 0.001) {
            const yieldProx = Math.max(0, (0.36 - dHome) / 0.36) * archSin;
            const yieldDist = Math.min(0.068, yieldProx * 0.082);
            b.piece.mesh.position.set(
              hx - (dHomeX / dHome) * yieldDist,
              BOARD_SURFACE_Y,
              hz - (dHomeZ / dHome) * yieldDist
            );
          } else {
            b.piece.mesh.position.copy(b.homePos);
          }

          const curBx = b.piece.mesh.position.x;
          const curBz = b.piece.mesh.position.z;
          const sepX = bx - curBx;
          const sepZ = bz - curBz;
          const sepDist = Math.hypot(sepX, sepZ);

          if (sepDist < effectiveMinSep) {
            if (sepDist > 0.0001) {
              const push = effectiveMinSep - sepDist;
              bx += (sepX / sepDist) * push;
              bz += (sepZ / sepDist) * push;
            } else {
              bx += segPerpX * effectiveMinSep;
              bz += segPerpZ * effectiveMinSep;
            }
          }
        }

        piece.mesh.position.set(bx, by, bz);
      }

      const savedCamPos = activeDuelSavedCam ? activeDuelSavedCam.pos.clone() : camera.position.clone();
      const savedTarget = activeDuelSavedCam ? activeDuelSavedCam.target.clone() : orbitControls.target.clone();

      const midPoint = new THREE.Vector3(
        (strikePos.x + victimPos.x) * 0.5,
        BOARD_SURFACE_Y + 0.32,
        (strikePos.z + victimPos.z) * 0.5
      );

      const perpA = new THREE.Vector3(-dirZ, 0, dirX);
      const perpB = new THREE.Vector3(dirZ, 0, -dirX);
      const camFromMid = new THREE.Vector3().subVectors(savedCamPos, midPoint);
      const prefPerp = camFromMid.dot(perpA) >= 0 ? perpA : perpB;
      const altPerp = prefPerp === perpA ? perpB : perpA;

      function scoreDuelPerpOcclusion(perpVec) {
        let penalty = 0;
        const probes = [
          { perpMul: 1.24, dirMul: -0.34 },
          { perpMul: 0.92, dirMul: 0.14 }
        ];
        for (const pr of probes) {
          const camX = midPoint.x + perpVec.x * pr.perpMul + dirX * pr.dirMul;
          const camZ = midPoint.z + perpVec.z * pr.perpMul + dirZ * pr.dirMul;
          const rayX = midPoint.x - camX;
          const rayZ = midPoint.z - camZ;
          const rayLenSq = Math.max(0.0001, rayX * rayX + rayZ * rayZ);
          for (const b of bystanders) {
            const bPos = b.piece && b.piece.mesh ? b.piece.mesh.position : b.homePos;
            if (!bPos) continue;
            const px = bPos.x - camX;
            const pz = bPos.z - camZ;
            const t = (px * rayX + pz * rayZ) / rayLenSq;
            if (t > 0.10 && t < 0.98) {
              const cx = camX + rayX * t;
              const cz = camZ + rayZ * t;
              const distB = Math.hypot(bPos.x - cx, bPos.z - cz);
              if (distB < 0.44) {
                penalty += (0.44 - distB) * 12.0;
              }
            }
          }
        }
        return penalty;
      }

      const chosenPerp =
        scoreDuelPerpOcclusion(prefPerp) > scoreDuelPerpOcclusion(altPerp) + 0.25 ? altPerp : prefPerp;

      const duelCamMid = new THREE.Vector3(
        midPoint.x + chosenPerp.x * 1.34 - dirX * 0.44,
        BOARD_SURFACE_Y + 0.96,
        midPoint.z + chosenPerp.z * 1.34 - dirZ * 0.44
      );
      const duelCamClose = new THREE.Vector3(
        midPoint.x + chosenPerp.x * 0.92 + dirX * 0.18,
        BOARD_SURFACE_Y + 0.74,
        midPoint.z + chosenPerp.z * 0.92 + dirZ * 0.18
      );
      const duelTargetStart = new THREE.Vector3(
        victimPos.x,
        BOARD_SURFACE_Y + 0.34,
        victimPos.z
      );
      const duelTargetEnd = new THREE.Vector3(
        endPos.x - dirX * 0.05,
        BOARD_SURFACE_Y + 0.30,
        endPos.z - dirZ * 0.05
      );

      function evalQuadraticBezier(outVec, p0, p1, p2, t) {
        const inv = 1 - t;
        const c0 = inv * inv;
        const c1 = 2 * inv * t;
        const c2 = t * t;
        outVec.set(
          c0 * p0.x + c1 * p1.x + c2 * p2.x,
          c0 * p0.y + c1 * p1.y + c2 * p2.y,
          c0 * p0.z + c1 * p1.z + c2 * p2.z
        );
      }

      if (isCapture) {
        activeDuelSavedCam = {
          pos: savedCamPos.clone(),
          target: savedTarget.clone()
        };
        orbitControls.enabled = false;
        cameraTelemetry.lastAttackSamples = [];
        cameraTelemetry.attackCount += 1;
        cameraTelemetry.maxStepDelta = 0;
        cameraTelemetry.minCombatSeparation = Infinity;
      } else {
        cameraTelemetry.lastSpaceMoveSamples = [];
      }

      const squaresMoved = Math.max(1, Math.hypot(toR - fromR, toC - fromC));
      const stdMoveDuration = Number((0.58 + Math.max(0, squaresMoved - 1) * 0.12).toFixed(3));
      const atkProfile = ATTACK_SYNC_PROFILES[piece.type] || ATTACK_SYNC_PROFILES.queen;
      const SWING_START_CLIP_TIME = atkProfile.swingStartClip;
      const CONTACT_CLIP_TIME = atkProfile.contactClip;
      const BLOW_CLIP_TIME = atkProfile.blowClip;
      const approachSquares = isCapture && capCoord
        ? Math.max(1, Math.hypot(capCoord.r - fromR, capCoord.c - fromC))
        : squaresMoved;
      const tApproach = isCapture
        ? Number((0.56 + Math.max(0, approachSquares - 1) * 0.11).toFixed(3))
        : stdMoveDuration;
      const tContact = isCapture ? (tApproach + CONTACT_CLIP_TIME / atkProfile.timeScale) : stdMoveDuration;
      const tImpact = isCapture ? (tApproach + BLOW_CLIP_TIME / atkProfile.timeScale) : stdMoveDuration;
      const tStrikeDone = isCapture ? (tImpact + 0.44) : stdMoveDuration;
      const camReturnDist = savedCamPos.distanceTo(duelCamClose);
      const returnDuration = isCapture ? Number((1.05 + Math.min(0.35, camReturnDist * 0.09)).toFixed(3)) : 0;
      const totalDuration = isCapture ? (tStrikeDone + returnDuration) : stdMoveDuration;

      // Efeito sonoro de pedra deslizando sobre o altar
      playStoneSlideSound(isCapture ? tApproach : stdMoveDuration, piece.type === 'queen');

      if (!isCapture) {
        cameraTelemetry.lastSpaceMoveDuration = stdMoveDuration;
        cameraTelemetry.lastSquaresMoved = Number(squaresMoved.toFixed(3));
      } else {
        cameraTelemetry.lastCaptureTiming = {
          pieceType: piece.type,
          squaresMoved: Number(squaresMoved.toFixed(3)),
          tApproach: Number(tApproach.toFixed(3)),
          tContact: Number(tContact.toFixed(3)),
          tImpact: Number(tImpact.toFixed(3)),
          tStrikeDone: Number(tStrikeDone.toFixed(3)),
          returnDuration: Number(returnDuration.toFixed(3)),
          totalDuration: Number(totalDuration.toFixed(3))
        };
      }

      let elapsed = 0;
      let attackAnimStarted = false;
      let defenderFlinchTriggered = false;
      let shatterTriggered = false;
      let impactActualTime = tImpact;
      const postShatterPiecePos = strikePos.clone();
      const postStrikePiecePos = strikePos.clone();
      let prevCamPos = camera.position.clone();
      let prevPiecePos = piece.mesh.position.clone();

      function finishMove() {
        resetBystandersToHome();
        boardState[fromR][fromC] = null;
        if (isCapture && capCoord) {
          if (captured && captured.mesh) {
            scene.remove(captured.mesh);
          }
          boardState[capCoord.r][capCoord.c] = null;
        }
        boardState[toR][toC] = piece;
        piece.r = toR;
        piece.c = toC;
        piece.hasMoved = true;

        if (isCapture) {
          if (piece.color === 'w') capturedByWhite += 1;
          else capturedByBlack += 1;
          if (capCoord) {
            chainCapturedSet.add(`${capCoord.r},${capCoord.c}`);
          }
          activeDuelSavedCam = null;
          camera.position.copy(savedCamPos);
          orbitControls.target.copy(savedTarget);
          orbitControls.enabled = true;
          orbitControls.update();
        }

        // Verificar se a mesma peça possui capturas adicionais em cadeia (Regra de Captura Múltipla)
        if (isCapture) {
          const nextTrees = getCaptureTreesForPiece(
            toR,
            toC,
            piece.type,
            piece.color,
            boardState,
            chainCapturedSet
          );
          if (nextTrees.length > 0) {
            activeChainSquare = { r: toR, c: toC };
            piece.mesh.position.copy(endPos);
            piece.mesh.rotation.y = piece.color === 'w' ? Math.PI : 0;
            playPieceClip(piece, 'Idle', true, 0.18);
            playStoneSettleSound(piece.type === 'queen');

            isAnimatingMove = false;
            selectedSquare = { r: toR, c: toC };
            validMoves = getLegalMovesForPiece(toR, toC);
            showSquareHighlights(toR, toC, validMoves);
            updateTurnUI();
            maybeScheduleAIMove();
            return;
          }
        }

        // Fim da jogada (sem mais capturas em cadeia)
        activeChainSquare = null;
        chainCapturedSet.clear();

        // Coroação em Dama: apenas se a pedra comum ('pawn') TERMINAR o turno na última fileira adversária!
        const promoRow = piece.color === 'w' ? 0 : 7;
        if (piece.type === 'pawn' && toR === promoRow) {
          scene.remove(piece.mesh);
          const promoted = instantiatePiece('queen', piece.color, toR, toC);
          promoted.hasMoved = true;
          boardState[toR][toC] = promoted;
          spawnCoronationBurst(endPos);
          if (moveHistory.length > 0 && moveHistory[moveHistory.length - 1]?.move) {
            moveHistory[moveHistory.length - 1].move.crowned = true;
          }
        } else {
          piece.mesh.position.copy(endPos);
          piece.mesh.rotation.y = piece.color === 'w' ? Math.PI : 0;
          playPieceClip(piece, 'Idle', true, 0.18);
          playStoneSettleSound(piece.type === 'queen');
        }

        // Regra do Assopro (Pedra Assoprada):
        // Se o jogador tinha captura disponível neste turno e escolheu NÃO comer (!isCapture),
        // a pedra que não foi usada para comer é assoprada (eliminada do tabuleiro)!
        if (!isCapture && preMoveCapturers.length > 0 && !options.fromRemote) {
          // Prioriza assoprar a outra pedra que tinha captura e foi ignorada;
          // se a própria pedra movida era a única que podia comer e fugiu/andou simples, assopra ela em (toR, toC).
          const otherCapturer = preMoveCapturers.find((c) => c.r !== fromR || c.c !== fromC);
          if (otherCapturer) {
            assoprarPedra(otherCapturer.r, otherCapturer.c);
          } else {
            assoprarPedra(toR, toC);
          }
        }

        currentTurn = currentTurn === 'w' ? 'b' : 'w';
        isAnimatingMove = false;
        updateTurnUI();
        maybeScheduleAIMove();
      }

      function stepMove(dt) {
        elapsed += dt;

        if (!isCapture) {
          const u = Math.min(1, elapsed / totalDuration);
          applyConcreteTrajectory(u, startPos, endPos);
          const pDelta = piece.mesh.position.distanceTo(prevPiecePos);
          prevPiecePos.copy(piece.mesh.position);
          cameraTelemetry.lastSpaceMoveSamples.push({
            t: Number(elapsed.toFixed(3)),
            u: Number(u.toFixed(3)),
            piecePos: [
              Number(piece.mesh.position.x.toFixed(3)),
              Number(piece.mesh.position.y.toFixed(3)),
              Number(piece.mesh.position.z.toFixed(3))
            ],
            pieceStep: Number(pDelta.toFixed(4))
          });
          if (u >= 1) {
            finishMove();
            return true;
          }
          return false;
        }

        // Coreografia de Captura por Salto Diagonal (Aproximação -> Golpe e Estilhaçamento -> Avanço até a casa de pouso vazia)
        let phaseName = 'approach';
        if (elapsed <= tStrikeDone) {
          const uActive = Math.min(1, elapsed / tStrikeDone);
          const sActive = 0.38 * uActive + 0.62 * easeInOutCubic(uActive);
          evalQuadraticBezier(camera.position, savedCamPos, duelCamMid, duelCamClose, sActive);
          evalQuadraticBezier(orbitControls.target, savedTarget, duelTargetStart, duelTargetEnd, sActive);

          if (elapsed <= tApproach) {
            phaseName = 'approach';
            const u = Math.min(1, elapsed / tApproach);
            applyConcreteTrajectory(u, startPos, strikePos);
          } else {
            phaseName = 'strike';
            if (!attackAnimStarted) {
              attackAnimStarted = true;
              playPieceClip(piece, 'Attack', false, 0.08);
              playWeaponSwingSound();
            }

            for (const b of bystanders) {
              const dxB = strikePos.x - b.homePos.x;
              const dzB = strikePos.z - b.homePos.z;
              const dB = Math.hypot(dxB, dzB);
              if (dB < 0.42 && dB > 0.001) {
                const yieldDist = ((0.42 - dB) / 0.42) * 0.068;
                b.piece.mesh.position.set(
                  b.homePos.x - (dxB / dB) * yieldDist,
                  BOARD_SURFACE_Y,
                  b.homePos.z - (dzB / dB) * yieldDist
                );
              } else {
                b.piece.mesh.position.copy(b.homePos);
              }
            }

            const atkClipTime = (elapsed - tApproach) * atkProfile.timeScale;

            if (!shatterTriggered && captured && captured.mesh) {
              const stalkLead = 0.028;
              let lungeOffset = 0;
              if (atkClipTime < SWING_START_CLIP_TIME) {
                const windupProgress = Math.min(1, atkClipTime / Math.max(0.05, SWING_START_CLIP_TIME));
                lungeOffset = windupProgress * stalkLead;
              } else {
                const slashPhase = Math.min(
                  1,
                  (atkClipTime - SWING_START_CLIP_TIME) / Math.max(0.05, BLOW_CLIP_TIME - SWING_START_CLIP_TIME)
                );
                lungeOffset =
                  stalkLead + Math.sin(slashPhase * Math.PI * 0.85) * Math.max(0.018, atkProfile.maxLunge - stalkLead);
              }
              piece.mesh.position.set(
                strikePos.x + dirX * lungeOffset,
                BOARD_SURFACE_Y,
                strikePos.z + dirZ * lungeOffset
              );
              if (atkClipTime < CONTACT_CLIP_TIME) {
                captured.mesh.position.copy(victimPos);
              } else {
                const shoveProgress = Math.min(
                  1,
                  (atkClipTime - CONTACT_CLIP_TIME) / Math.max(0.04, BLOW_CLIP_TIME - CONTACT_CLIP_TIME)
                );
                const shoveDist = shoveProgress * 0.045;
                captured.mesh.position.set(
                  victimPos.x + dirX * shoveDist,
                  BOARD_SURFACE_Y,
                  victimPos.z + dirZ * shoveDist
                );
              }

              const curSep = piece.mesh.position.distanceTo(captured.mesh.position);
              if (curSep < (cameraTelemetry.minCombatSeparation ?? Infinity)) {
                cameraTelemetry.minCombatSeparation = Number(curSep.toFixed(3));
              }
            }

            if (
              !defenderFlinchTriggered &&
              (atkClipTime >= CONTACT_CLIP_TIME || elapsed >= tContact + 0.06)
            ) {
              defenderFlinchTriggered = true;
              if (captured) {
                playPieceClip(captured, 'Shatter', false, 0.04);
                impactFlashLight.position.set(
                  victimPos.x - dirX * 0.08,
                  BOARD_SURFACE_Y + 0.28,
                  victimPos.z - dirZ * 0.08
                );
                impactFlashLight.intensity = 4.5;
              }
            }

            if (!shatterTriggered && (atkClipTime >= BLOW_CLIP_TIME || elapsed >= tImpact + 0.06)) {
              shatterTriggered = true;
              impactActualTime = elapsed;
              postShatterPiecePos.copy(piece.mesh.position);
              if (captured && captured.mesh) {
                const exactCaptureOrigin = victimPos.clone();
                scene.remove(captured.mesh);
                spawnStoneShatter(exactCaptureOrigin, captured.color, { x: dirX, z: dirZ });
              }
            }

            if (shatterTriggered) {
              const postStrikeSpan = Math.max(0.08, tStrikeDone - impactActualTime);
              const uFollow = Math.min(1, Math.max(0, (elapsed - impactActualTime) / postStrikeSpan));
              piece.mesh.position.lerpVectors(postShatterPiecePos, endPos, uFollow * 0.42);
              postStrikePiecePos.copy(piece.mesh.position);
            }

            if (shatterTriggered && elapsed >= impactActualTime && elapsed <= impactActualTime + 0.26) {
              const shakeProgress = (elapsed - impactActualTime) / 0.26;
              const decay = (1 - shakeProgress) * (1 - shakeProgress);
              const amp = 0.024 * decay;
              camera.position.y += Math.sin(shakeProgress * Math.PI * 8) * amp;
            }
          }
        } else {
          // Phase 3: Pousa na casa vazia após a vítima e retorna suavemente a câmera
          phaseName = 'return';
          const uReturn = Math.min(1, (elapsed - tStrikeDone) / Math.max(0.1, totalDuration - tStrikeDone));
          const easeRet = easeInOutCubic(uReturn);
          const pieceAdvanceBlend = 0.35 * uReturn + 0.65 * easeRet;

          piece.mesh.position.lerpVectors(postStrikePiecePos, endPos, pieceAdvanceBlend);
          camera.position.lerpVectors(duelCamClose, savedCamPos, easeRet);
          orbitControls.target.lerpVectors(duelTargetEnd, savedTarget, easeRet);
        }

        camera.lookAt(orbitControls.target);

        const stepDelta = camera.position.distanceTo(prevCamPos);
        const pieceStepDelta = piece.mesh.position.distanceTo(prevPiecePos);
        if (stepDelta > cameraTelemetry.maxStepDelta) {
          cameraTelemetry.maxStepDelta = stepDelta;
        }
        prevCamPos.copy(camera.position);
        prevPiecePos.copy(piece.mesh.position);

        cameraTelemetry.lastAttackSamples.push({
          t: Number(elapsed.toFixed(3)),
          phase: phaseName,
          camStep: Number(stepDelta.toFixed(4)),
          pieceStep: Number(pieceStepDelta.toFixed(4)),
          pos: [
            Number(camera.position.x.toFixed(3)),
            Number(camera.position.y.toFixed(3)),
            Number(camera.position.z.toFixed(3))
          ],
          target: [
            Number(orbitControls.target.x.toFixed(3)),
            Number(orbitControls.target.y.toFixed(3)),
            Number(orbitControls.target.z.toFixed(3))
          ],
          piecePos: [
            Number(piece.mesh.position.x.toFixed(3)),
            Number(piece.mesh.position.y.toFixed(3)),
            Number(piece.mesh.position.z.toFixed(3))
          ]
        });

        if (elapsed >= totalDuration) {
          finishMove();
          return true;
        }
        return false;
      }

      activeMoveTweens.push(stepMove);
      return true;
    }

    const activeMoveTweens = [];

    // =========================================================================
    // Inteligência Artificial Tática para Damas Brasileiras
    // =========================================================================
    function chooseSmartAIMove(color) {
      const allMoves = getAllLegalMoves(color);
      if (allMoves.length === 0) return null;

      // A IA sempre prioriza comer quando há captura disponível para não ter sua pedra assoprada!
      const captureOnlyMoves = allMoves.filter((m) => m.capture);
      let legalMoves = allMoves;
      if (captureOnlyMoves.length > 0) {
        let maxChain = 0;
        for (const cm of captureOnlyMoves) {
          if ((cm.maxChainCount || 1) > maxChain) maxChain = cm.maxChainCount || 1;
        }
        legalMoves = captureOnlyMoves.filter((cm) => (cm.maxChainCount || 1) === maxChain);
      }

      let bestScore = -Infinity;
      let bestCandidates = [];
      const oppColor = color === 'w' ? 'b' : 'w';
      const promoRow = color === 'w' ? 0 : 7;
      const homeRow = color === 'w' ? 7 : 0;

      for (const m of legalMoves) {
        const piece = boardState[m.fromR][m.fromC];
        if (!piece) continue;
        let score = 0;

        // 1. Recompensa por capturas e tamanho da cadeia
        if (m.capture) {
          const capturedPiece = m.capturedR >= 0 ? boardState[m.capturedR]?.[m.capturedC] : null;
          const capVal = capturedPiece ? PIECE_VALUES[capturedPiece.type] : 100;
          score += capVal * 1.4 + (m.maxChainCount || 1) * 120;
        }

        // 2. Bônus por coroação em Dama
        if (piece.type === 'pawn' && m.toR === promoRow && (!m.capture || (m.maxChainCount || 1) === 1)) {
          score += 240;
        }

        // 3. Avanço estratégico de pedras operárias e proteção da primeira fileira (atrasar saída da base)
        if (piece.type === 'pawn') {
          const advance = color === 'w' ? (7 - m.toR) : m.toR;
          score += advance * 14;
          if (m.fromR === homeRow && !m.capture) {
            score -= 18; // Preservar a fileira de fundo fechada contra damas inimigas
          }
        }

        // 4. Controle das casas centrais e segurança nas bordas laterais (colunas 0 e 7 não podem ser comidas no próximo lance)
        if (m.toC === 0 || m.toC === 7) {
          score += 16;
        } else {
          const centerDist = Math.abs(3.5 - m.toR) + Math.abs(3.5 - m.toC);
          score += (7 - centerDist) * 6;
        }

        // 5. Simulação de 1 passo: verificar se o lance entrega captura gratuita ao adversário
        const savedFrom = boardState[m.fromR][m.fromC];
        const savedCap = m.capture && m.capturedR >= 0 ? boardState[m.capturedR][m.capturedC] : null;
        boardState[m.fromR][m.fromC] = null;
        if (m.capture && m.capturedR >= 0) {
          boardState[m.capturedR][m.capturedC] = null;
        }
        boardState[m.toR][m.toC] = piece;

        const oppMaxCap = getGlobalMaxCapturesForColor(oppColor, boardState);
        if (oppMaxCap > 0) {
          score -= oppMaxCap * 135;
        }

        boardState[m.toR][m.toC] = null;
        if (m.capture && m.capturedR >= 0) {
          boardState[m.capturedR][m.capturedC] = savedCap;
        }
        boardState[m.fromR][m.fromC] = savedFrom;

        // Pequena variação para partidas variadas
        score += (Math.random() - 0.5) * 12;

        if (score > bestScore + 1) {
          bestScore = score;
          bestCandidates = [m];
        } else if (Math.abs(score - bestScore) <= 1) {
          bestCandidates.push(m);
        }
      }

      return bestCandidates[Math.floor(Math.random() * bestCandidates.length)] || legalMoves[0];
    }

    function triggerAIMoveNow() {
      if (isAnimatingMove || gameOver) return false;
      const chosen = chooseSmartAIMove(currentTurn);
      if (!chosen) return false;
      return executeChessMove(chosen.fromR, chosen.fromC, chosen.toR, chosen.toC);
    }

    function maybeScheduleAIMove() {
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      if (gameOver || isAnimatingMove || preMoveHighlightTask) return;
      if (scriptedGameActive) return;
      if (gameMode !== 'single' || !aiAutoPlay) return;

      const aiColor = playerColor === 'w' ? 'b' : 'w';
      if (currentTurn === aiColor) {
        const delayMs = activeChainSquare ? 420 : 540;
        aiTimer = setTimeout(() => {
          aiTimer = null;
          if (
            !scriptedGameActive &&
            gameMode === 'single' &&
            currentTurn === aiColor &&
            !isAnimatingMove &&
            !gameOver
          ) {
            triggerAIMoveNow();
          }
        }, delayMs);
      }
    }

    function createInitialVirtualBoard() {
      const b = Array.from({ length: 8 }, () => Array(8).fill(null));
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if ((r + c) % 2 === 1) {
            if (r <= 2) b[r][c] = { type: 'pawn', color: 'b', hasMoved: false };
            else if (r >= 5) b[r][c] = { type: 'pawn', color: 'w', hasMoved: false };
          }
        }
      }
      return b;
    }

    function getVirtualLegalMovesForSquare(r, c, vBoard) {
      const piece = vBoard[r][c];
      if (!piece) return [];
      const pseudo = getPseudoMovesForPiece(r, c, vBoard);
      const legal = [];
      for (const m of pseudo) {
        const savedTarget = vBoard[m.r][m.c];
        vBoard[m.r][m.c] = piece;
        vBoard[r][c] = null;
        const inCheck = isKingInCheck(piece.color, vBoard);
        vBoard[r][c] = piece;
        vBoard[m.r][m.c] = savedTarget;
        if (!inCheck) legal.push(m);
      }
      return legal;
    }

    function parseNotationToMoves(notationText) {
      const cleaned = String(notationText || '')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\{[^}]*\}/g, ' ')
        .replace(/;[^\n]*/g, ' ')
        .replace(/\([^)]*\)/g, ' ');

      const rawTokens = cleaned
        .split(/\s+/)
        .map((t) => t.replace(/^\d+\.+/g, '').trim())
        .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*|\d+\.?)$/.test(t));

      const vBoard = createInitialVirtualBoard();
      let turn = 'w';
      const parsedMoves = [];
      const promoMap = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
      const sanPieceMap = { N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king', P: 'pawn' };

      for (const rawTok of rawTokens) {
        let tok = rawTok.replace(/[+#!?]+$/g, '');
        if (!tok) continue;

        let matched = null;

        // 1. Castling (O-O / 0-0 / O-O-O / 0-0-0)
        if (/^(O-O-O|0-0-0|O-O|0-0)$/i.test(tok)) {
          const isQueenside = tok.length >= 5;
          const kr = turn === 'w' ? 7 : 0;
          const fromC = 4;
          const toC = isQueenside ? 2 : 6;
          if (vBoard[kr][fromC] && vBoard[kr][fromC].type === 'king') {
            matched = {
              fromR: kr,
              fromC,
              toR: kr,
              toC,
              pieceType: 'king',
              capture: false,
              promotion: null,
              castling: isQueenside ? 'q' : 'k'
            };
          }
        }

        // 2. Coordinate / UCI notation (e.g. e2e4, e2-e4, e4xd5, g1f3, e7e8q)
        if (!matched) {
          const uciMatch = tok.match(/^([a-h])([1-8])[-x]?([a-h])([1-8])(?:=?([qrbnQRBN]))?$/);
          if (uciMatch) {
            const fromC = uciMatch[1].charCodeAt(0) - 97;
            const fromR = 8 - parseInt(uciMatch[2], 10);
            const toC = uciMatch[3].charCodeAt(0) - 97;
            const toR = 8 - parseInt(uciMatch[4], 10);
            const promoChar = uciMatch[5] ? uciMatch[5].toLowerCase() : null;
            const p = vBoard[fromR]?.[fromC];
            if (p && p.color === turn) {
              matched = {
                fromR,
                fromC,
                toR,
                toC,
                pieceType: p.type,
                capture: Boolean(vBoard[toR]?.[toC]),
                promotion: promoChar ? promoMap[promoChar] : null
              };
            }
          }
        }

        // 3. Standard Algebraic Notation (SAN: e4, exd5, Nf3, Nc6, Bc4, Qxd5, Nbd7, R1e2, e8=Q)
        if (!matched) {
          let promotion = null;
          const promoEq = tok.match(/=([QRBNqrbn])$/);
          if (promoEq) {
            promotion = promoMap[promoEq[1].toLowerCase()] || 'queen';
            tok = tok.slice(0, -2);
          }

          let pieceType = 'pawn';
          let rest = tok;
          if (/^[NBRQK]/.test(rest)) {
            pieceType = sanPieceMap[rest[0]];
            rest = rest.slice(1);
          } else if (/^P/.test(rest)) {
            pieceType = 'pawn';
            rest = rest.slice(1);
          }

          const destMatch = rest.match(/([a-h])([1-8])$/);
          if (destMatch) {
            const toC = destMatch[1].charCodeAt(0) - 97;
            const toR = 8 - parseInt(destMatch[2], 10);
            const prefix = rest.slice(0, rest.length - 2).replace(/x/g, '');

            let disambigC = null;
            let disambigR = null;
            for (const ch of prefix) {
              if (ch >= 'a' && ch <= 'h') disambigC = ch.charCodeAt(0) - 97;
              else if (ch >= '1' && ch <= '8') disambigR = 8 - parseInt(ch, 10);
            }

            const candidates = [];
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const p = vBoard[r][c];
                if (!p || p.color !== turn || p.type !== pieceType) continue;
                if (disambigC !== null && c !== disambigC) continue;
                if (disambigR !== null && r !== disambigR) continue;
                const legals = getVirtualLegalMovesForSquare(r, c, vBoard);
                const hit = legals.find((m) => m.r === toR && m.c === toC);
                if (hit) {
                  candidates.push({
                    fromR: r,
                    fromC: c,
                    toR,
                    toC,
                    pieceType,
                    capture: Boolean(hit.capture || vBoard[toR][toC]),
                    promotion
                  });
                }
              }
            }
            if (candidates.length > 0) {
              matched = candidates[0];
            }
          }
        }

        if (!matched) {
          console.warn('Could not parse notation token:', rawTok);
          break;
        }

        const movingPiece = vBoard[matched.fromR][matched.fromC];
        vBoard[matched.fromR][matched.fromC] = null;
        if (matched.castling) {
          const kr = matched.fromR;
          if (matched.castling === 'k') {
            vBoard[kr][5] = vBoard[kr][7];
            vBoard[kr][7] = null;
          } else {
            vBoard[kr][3] = vBoard[kr][0];
            vBoard[kr][0] = null;
          }
        }
        const finalType =
          matched.promotion ||
          (movingPiece.type === 'pawn' && (matched.toR === 0 || matched.toR === 7)
            ? 'queen'
            : movingPiece.type);
        vBoard[matched.toR][matched.toC] = {
          type: finalType,
          color: turn,
          hasMoved: true
        };

        parsedMoves.push({
          index: parsedMoves.length,
          ply: parsedMoves.length + 1,
          moveNumber: Math.floor(parsedMoves.length / 2) + 1,
          color: turn,
          san: rawTok,
          fromR: matched.fromR,
          fromC: matched.fromC,
          toR: matched.toR,
          toC: matched.toC,
          pieceType: matched.pieceType,
          capture: matched.capture,
          promotion: matched.promotion || 'queen'
        });

        turn = turn === 'w' ? 'b' : 'w';
      }

      return parsedMoves;
    }

    function updateScriptBarUI() {
      const label = document.getElementById('script-step-label');
      const statusMsg = document.getElementById('script-status-msg');
      const prevBtn = document.getElementById('btn-script-prev');
      const nextBtn = document.getElementById('btn-script-next');

      const total = scriptMoves.length;
      if (label) {
        if (total === 0) {
          label.textContent = `Move ${moveHistory.length}`;
        } else if (scriptDeviated) {
          label.textContent = `Move ${moveHistory.length} • Custom Takeover`;
        } else if (scriptCursor < total) {
          const nextSan = scriptMoves[scriptCursor].san;
          label.textContent = `Step ${scriptCursor}/${total} • Next: ${nextSan}`;
        } else {
          label.textContent = `Step ${total}/${total} (Done)`;
        }
      }
      if (prevBtn) {
        prevBtn.disabled = moveHistory.length === 0 && !preMoveHighlightTask && !isAnimatingMove;
      }
      if (nextBtn) {
        nextBtn.disabled = gameOver || (!scriptDeviated && total > 0 && scriptCursor >= total && !preMoveHighlightTask);
      }
      if (statusMsg && total > 0) {
        if (scriptDeviated) {
          statusMsg.textContent = `Custom takeover active at Move ${moveHistory.length} (Use [ to step back or ] for AI move).`;
        } else {
          statusMsg.textContent = `Loaded ${total} half-moves. Step ${scriptCursor}/${total} ready (Use [ and ] to step, Arrow keys to rotate cam).`;
        }
      }
    }

    const DEFAULT_DIRECTOR_NOTATION =
      '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8 4. d4 c6 5. Bc4 h6 6. Nf3 Bg4 7. Bxf7+ Kxf7 8. Ne5+ Ke8 9. Qxg4 Nf6 10. Qg6#';

    function loadNotationScript(notationStr, options = {}) {
      const parsed = parseNotationToMoves(notationStr);
      scriptMoves = parsed;
      scriptCursor = 0;
      scriptDeviated = false;
      scriptedGameActive = parsed.length > 0;
      const inputEl = document.getElementById('input-notation');
      if (inputEl && notationStr) {
        inputEl.value = notationStr;
      }
      resetChessBoard(Boolean(options.orientCamera), true);
      updateScriptBarUI();
      return {
        ok: parsed.length > 0,
        count: parsed.length,
        moves: parsed
      };
    }

    function completeCurrentMoveImmediately() {
      if (preMoveHighlightTask) {
        const mv = preMoveHighlightTask.move;
        const fromScriptFlag = Boolean(preMoveHighlightTask.fromScript);
        preMoveHighlightTask = null;
        executeChessMove(mv.fromR, mv.fromC, mv.toR, mv.toC, { fromScript: fromScriptFlag });
      }
      let safety = 0;
      while (activeMoveTweens.length > 0 && safety < 200) {
        safety++;
        for (let i = activeMoveTweens.length - 1; i >= 0; i--) {
          const done = activeMoveTweens[i](0.05);
          if (done) activeMoveTweens.splice(i, 1);
        }
      }
    }

    function isScriptMoveLegalOnCurrentBoard(mv) {
      if (!mv) return false;
      const piece = boardState[mv.fromR]?.[mv.fromC];
      if (!piece || piece.color !== currentTurn) return false;
      const destPiece = boardState[mv.toR]?.[mv.toC];
      if (destPiece && destPiece.color === piece.color) return false;
      const legals = getLegalMovesForPiece(mv.fromR, mv.fromC);
      return legals.some((m) => m.r === mv.toR && m.c === mv.toC);
    }

    function stepScriptForward() {
      if (gameOver) return false;

      // If a move animation or pre-move highlight is currently running, finish it cleanly before advancing
      if (isAnimatingMove || preMoveHighlightTask) {
        completeCurrentMoveImmediately();
        if (gameOver) return false;
        if (!scriptDeviated && scriptMoves.length > 0 && scriptCursor >= scriptMoves.length) return false;
      }

      // If no notation script has been loaded yet and no moves have been played, parse the default script in #input-notation
      if (scriptMoves.length === 0 && moveHistory.length === 0) {
        const defaultPgn =
          document.getElementById('input-notation')?.value || DEFAULT_DIRECTOR_NOTATION;
        loadNotationScript(defaultPgn, { orientCamera: false });
      }

      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }

      // Determine whether the next scripted move is still valid on the current board
      let nextMove = null;
      let isFromScript = false;
      if (!scriptDeviated && scriptCursor < scriptMoves.length) {
        const candidate = scriptMoves[scriptCursor];
        if (isScriptMoveLegalOnCurrentBoard(candidate)) {
          nextMove = candidate;
          isFromScript = true;
          scriptedGameActive = true;
        } else {
          scriptDeviated = true;
          scriptedGameActive = false;
        }
      }

      // If the user took over and deviated from the script, Next ] cleanly executes a smart legal move for currentTurn
      if (!nextMove) {
        if (!scriptDeviated && scriptMoves.length > 0 && scriptCursor >= scriptMoves.length) {
          return false;
        }
        const aiFallback = chooseSmartAIMove(currentTurn);
        if (!aiFallback) return false;
        nextMove = {
          fromR: aiFallback.fromR,
          fromC: aiFallback.fromC,
          toR: aiFallback.toR,
          toC: aiFallback.toC,
          color: currentTurn
        };
        isFromScript = false;
      }

      const chkHighlight = document.getElementById('chk-premove-highlight');
      const chkBoth = document.getElementById('chk-premove-both');
      const showPreHighlight = chkHighlight ? chkHighlight.checked : true;
      const highlightBothSides = chkBoth ? chkBoth.checked : false;

      // Feature 3c: When triggering moves for the player's side (or both sides if toggled),
      // first show selecting the piece and its legal destination squares before executing the move!
      if (showPreHighlight && (nextMove.color === playerColor || highlightBothSides)) {
        selectedSquare = { r: nextMove.fromR, c: nextMove.fromC };
        validMoves = getLegalMovesForPiece(nextMove.fromR, nextMove.fromC);
        showSquareHighlights(nextMove.fromR, nextMove.fromC, validMoves);
        preMoveHighlightTask = {
          move: nextMove,
          fromScript: isFromScript,
          elapsedSim: 0,
          startWallMs: performance.now(),
          duration: 0.62
        };
        updateScriptBarUI();
        return true;
      }

      return executeChessMove(nextMove.fromR, nextMove.fromC, nextMove.toR, nextMove.toC, {
        fromScript: isFromScript
      });
    }

    function stepScriptBackward() {
      if (preMoveHighlightTask) {
        preMoveHighlightTask = null;
        clearSquareHighlights();
        selectedSquare = null;
        validMoves = [];
        updateScriptBarUI();
        return true;
      }

      if (moveHistory.length === 0) {
        return false;
      }

      const lastEntry = moveHistory.pop();
      restoreBoardSnapshot(lastEntry.snapshot);
      return true;
    }

    // =========================================================================
    // Feature 1: Toggle All On-Screen UI Off/On for Clean Cinematic Recording
    // =========================================================================
    function toggleUI(forceHidden) {
      const shouldHide =
        typeof forceHidden === 'boolean'
          ? forceHidden
          : !document.body.classList.contains('cinematic-ui-hidden');
      document.body.classList.toggle('cinematic-ui-hidden', shouldHide);
      const btnHide = document.getElementById('btn-hide-ui');
      if (btnHide) {
        btnHide.textContent = shouldHide ? 'Mostrar UI [H]' : 'Ocultar UI [H]';
      }
      return shouldHide;
    }

    // =========================================================================
    // Feature 4: Video-Game Style WASD + R/F Translation & Arrow-Key Rotation
    // with Configurable Speed (Default 10%) & Smooth Ease-In / Ease-Out
    // =========================================================================
    const heldCameraKeys = new Set();
    const CAM_MOVE_KEY_CODES = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyR',
      'KeyF',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight'
    ]);
    let cameraKeySpeedPct = 35;
    let cameraRotSpeedPct = 35;
    const keyMoveVelocity = new THREE.Vector3(0, 0, 0);
    const keyRotVelocity = { yaw: 0, pitch: 0 };

    function setCameraKeySpeedPercent(pct) {
      const clamped = Math.max(1, Math.min(200, Math.round(Number(pct) || 10)));
      cameraKeySpeedPct = clamped;
      const sliderEl = document.getElementById('input-cam-speed');
      const valEl = document.getElementById('cam-speed-val');
      if (sliderEl && Number(sliderEl.value) !== clamped) {
        sliderEl.value = String(clamped);
      }
      if (valEl) {
        valEl.textContent = `${clamped}%`;
      }
      return cameraKeySpeedPct;
    }

    function setCameraRotSpeedPercent(pct) {
      const clamped = Math.max(1, Math.min(200, Math.round(Number(pct) || 10)));
      cameraRotSpeedPct = clamped;
      const sliderEl = document.getElementById('input-rot-speed');
      const valEl = document.getElementById('rot-speed-val');
      if (sliderEl && Number(sliderEl.value) !== clamped) {
        sliderEl.value = String(clamped);
      }
      if (valEl) {
        valEl.textContent = `${clamped}%`;
      }
      return cameraRotSpeedPct;
    }

    const camSpeedSliderEl = document.getElementById('input-cam-speed');
    if (camSpeedSliderEl) {
      camSpeedSliderEl.addEventListener('input', (e) => {
        setCameraKeySpeedPercent(e.target.value);
      });
      camSpeedSliderEl.addEventListener('change', (e) => {
        setCameraKeySpeedPercent(e.target.value);
      });
    }

    const rotSpeedSliderEl = document.getElementById('input-rot-speed');
    if (rotSpeedSliderEl) {
      rotSpeedSliderEl.addEventListener('input', (e) => {
        setCameraRotSpeedPercent(e.target.value);
      });
      rotSpeedSliderEl.addEventListener('change', (e) => {
        setCameraRotSpeedPercent(e.target.value);
      });
    }

    function isTypingInInput(el) {
      if (!el) return false;
      const tag = (el.tagName || '').toUpperCase();
      if (tag === 'TEXTAREA' || el.isContentEditable) return true;
      if (tag === 'INPUT') {
        const type = (el.type || '').toLowerCase();
        return type !== 'range' && type !== 'checkbox' && type !== 'button';
      }
      return false;
    }

    window.addEventListener('keydown', (e) => {
      if (isTypingInInput(document.activeElement)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (CAM_MOVE_KEY_CODES.has(e.code)) {
        e.preventDefault();
        heldCameraKeys.add(e.code);
        return;
      }

      if (e.code === 'KeyH' || e.code === 'KeyU') {
        e.preventDefault();
        toggleUI();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleSound();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (CAM_MOVE_KEY_CODES.has(e.code)) {
        heldCameraKeys.delete(e.code);
      }
    });

    window.addEventListener('blur', () => {
      heldCameraKeys.clear();
    });

    // =========================================================================
    // Sequência de Fim de Jogo e Banner de Vitória nas Damas Brasileiras
    // =========================================================================
    function spawnKingFallImpact(worldPos, color) {
      const mat = color === 'w' ? whitePieceMat : blackPieceMat;
      for (let i = 0; i < 18; i++) {
        const sz = 0.015 + Math.random() * 0.028;
        const geo = new THREE.DodecahedronGeometry(sz, 0);
        const frag = new THREE.Mesh(geo, mat);
        frag.position.set(
          worldPos.x + (Math.random() - 0.5) * 0.14,
          BOARD_SURFACE_Y + 0.04 + Math.random() * 0.10,
          worldPos.z + (Math.random() - 0.5) * 0.14
        );
        frag.castShadow = true;
        scene.add(frag);
        shatterDebris.push({
          mesh: frag,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 1.45,
            0.65 + Math.random() * 1.25,
            (Math.random() - 0.5) * 1.45
          ),
          rotVel: new THREE.Vector3(
            Math.random() * 8,
            Math.random() * 8,
            Math.random() * 8
          ),
          life: 1.65
        });
      }
      impactFlashLight.position.set(worldPos.x, BOARD_SURFACE_Y + 0.35, worldPos.z);
      impactFlashLight.intensity = 6.2;
    }

    function showCheckmateBanner(winnerColor, defeatedColor) {
      const overlay = document.getElementById('checkmate-overlay');
      const crownEl = document.getElementById('checkmate-crown');
      const titleEl = document.getElementById('checkmate-title');
      const subEl = document.getElementById('checkmate-subtitle');

      const winnerName = winnerColor === 'w' ? 'Brancas' : 'Pretas';
      const defeatedName = defeatedColor === 'w' ? 'Brancas' : 'Pretas';

      if (crownEl) crownEl.textContent = winnerColor === 'w' ? '♕' : '♛';
      if (titleEl) titleEl.textContent = 'Vitória nas Damas!';
      if (subEl) {
        subEl.textContent = `As ${winnerName} Vencem • Pedras ${defeatedName} Sem Movimentos`;
      }
      if (overlay) {
        overlay.classList.add('visible');
      }
      if (!checkmateState.bannerVisible) {
        playVictorySound();
      }
      checkmateState.bannerVisible = true;
    }

    function triggerCheckmateSequence(defeatedColor = currentTurn, winnerColor = null) {
      const actualWinner = winnerColor || (defeatedColor === 'w' ? 'b' : 'w');

      // Find any remaining defeated piece on the board (if blocked), otherwise celebrate immediately
      let targetPiece = null;
      let targetR = -1;
      let targetC = -1;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (p && p.color === defeatedColor) {
            targetPiece = p;
            targetR = r;
            targetC = c;
            break;
          }
        }
        if (targetPiece) break;
      }

      checkmateState.active = true;
      checkmateState.defeatedColor = defeatedColor;
      checkmateState.winnerColor = actualWinner;
      checkmateState.kingFallAngleDeg = 0;
      checkmateState.phase = 'stagger';

      if (!targetPiece || !targetPiece.mesh) {
        checkmateState.phase = 'fallen';
        showCheckmateBanner(actualWinner, defeatedColor);
        return true;
      }

      const homePos = boardToWorld(targetR, targetC);
      const forwardDirZ = defeatedColor === 'b' ? 1 : -1;
      const fallDirX = 0.24;
      const fallDirZ = forwardDirZ * 0.97;

      if (targetPiece.currentAction) {
        targetPiece.currentAction.paused = true;
      }

      const baseYaw = defeatedColor === 'w' ? Math.PI : 0;
      const qBaseFacing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), baseYaw);
      const tiltAxis = new THREE.Vector3(fallDirZ, 0, -fallDirX).normalize();
      const qTilt = new THREE.Quaternion();

      const RIM_RADIUS = 0.135;
      const MAX_FALL_RAD = 1.50;
      const tStagger = 0.32;
      const tImpact = 0.96;
      const tTotal = 1.45;

      let elapsed = 0;
      let impactTriggered = false;
      let bannerShown = false;

      function applyTopplePose(thetaRad, shudderRoll = 0) {
        const clampedTheta = Math.max(-0.15, Math.min(1.55, thetaRad));
        checkmateState.kingFallAngleDeg = Number(((clampedTheta * 180) / Math.PI).toFixed(1));

        const px = homePos.x + fallDirX * RIM_RADIUS * (1 - Math.cos(clampedTheta));
        const py = BOARD_SURFACE_Y + RIM_RADIUS * Math.sin(Math.max(0, clampedTheta));
        const pz = homePos.z + fallDirZ * RIM_RADIUS * (1 - Math.cos(clampedTheta));
        targetPiece.mesh.position.set(px, py, pz);

        qTilt.setFromAxisAngle(tiltAxis, clampedTheta);
        if (Math.abs(shudderRoll) > 1e-4) {
          const qShudder = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(fallDirX, 0, fallDirZ),
            shudderRoll
          );
          qTilt.multiply(qShudder);
        }
        targetPiece.mesh.quaternion.copy(qTilt).multiply(qBaseFacing);
      }

      function stepFall(dt) {
        if (!checkmateState.active || !targetPiece.mesh) return true;
        elapsed += dt;

        if (!bannerShown && elapsed >= 0.35) {
          bannerShown = true;
          showCheckmateBanner(actualWinner, defeatedColor);
        }

        if (elapsed <= tStagger) {
          checkmateState.phase = 'stagger';
          const u = elapsed / tStagger;
          const shudder = Math.sin(u * Math.PI * 6) * 0.065 * (1 - u * 0.3);
          const initialLean = u * u * 0.12;
          applyTopplePose(initialLean, shudder);
        } else if (elapsed <= tImpact) {
          checkmateState.phase = 'topple';
          const u = Math.min(1, (elapsed - tStagger) / (tImpact - tStagger));
          const gravCurve = Math.pow(u, 2.25);
          const theta = 0.12 + (MAX_FALL_RAD - 0.12) * gravCurve;
          applyTopplePose(theta, 0);
        } else {
          checkmateState.phase = 'impact';
          if (!impactTriggered) {
            impactTriggered = true;
            const impactPos = new THREE.Vector3(
              homePos.x + fallDirX * 0.35,
              BOARD_SURFACE_Y,
              homePos.z + fallDirZ * 0.35
            );
            spawnKingFallImpact(impactPos, defeatedColor);
          }

          const uBounce = Math.min(1, (elapsed - tImpact) / (tTotal - tImpact));
          const bounceAmp = 0.12 * Math.pow(1 - uBounce, 1.85);
          const theta = MAX_FALL_RAD - Math.abs(Math.sin(uBounce * Math.PI * 2.0)) * bounceAmp;
          applyTopplePose(theta, 0);
        }

        if (elapsed >= tTotal) {
          applyTopplePose(MAX_FALL_RAD, 0);
          checkmateState.phase = 'fallen';
          if (!bannerShown) {
            showCheckmateBanner(actualWinner, defeatedColor);
          }
          return true;
        }
        return false;
      }

      activeMoveTweens.push(stepFall);
      return true;
    }

    // =========================================================================
    // Destaque Visual das Pedras com Captura Disponível (Sujeitas a Assopro se Ignoradas)
    // =========================================================================
    function showMandatoryCaptureHints(legalMoves) {
      if (!legalMoves || legalMoves.length === 0) return;
      const captureMoves = legalMoves.filter((m) => m.capture);
      if (captureMoves.length === 0) return;
      const originKeySet = new Set();
      for (const m of captureMoves) {
        const key = `${m.fromR},${m.fromC}`;
        if (originKeySet.has(key)) continue;
        originKeySet.add(key);

        const pos = boardToWorld(m.fromR, m.fromC);
        const pulseRingGeo = new THREE.RingGeometry(0.145, 0.175, 32);
        pulseRingGeo.rotateX(-Math.PI / 2);
        const pulseRingMat = new THREE.MeshBasicMaterial({
          color: 0xf5d76e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
        pulseRing.position.set(pos.x, BOARD_SURFACE_Y + 0.011, pos.z);
        squareHighlightsGroup.add(pulseRing);
      }
    }

    // =========================================================================
    // UI & Turn Status Updates (Damas Brasileiras 8x8 com Regra do Assopro)
    // =========================================================================
    function updateTurnUI() {
      const turnDot = document.getElementById('turn-dot');
      const turnText = document.getElementById('turn-text');
      const modeBadge = document.getElementById('mode-badge');
      const btnModeToggle = document.getElementById('btn-mode-toggle');
      const btnAiMove = document.getElementById('btn-ai-move');
      const btnSideToggle = document.getElementById('btn-side-toggle');
      const roomPill = document.getElementById('room-pill');
      const capturedTray = document.getElementById('captured-tray');

      if (turnDot) {
        turnDot.className = 'turn-dot' + (currentTurn === 'b' ? ' black' : '');
      }

      const legalMoves = getAllLegalMoves(currentTurn);
      const captureMoves = legalMoves.filter((m) => m.capture);
      const hasCaptureAvailable = captureMoves.length > 0;

      if (legalMoves.length === 0) {
        gameOver = true;
        const winnerColor = currentTurn === 'w' ? 'b' : 'w';
        const winnerName = winnerColor === 'w' ? 'Brancas' : 'Pretas';
        if (turnText) {
          turnText.textContent = `Fim de Jogo — Vitória das ${winnerName}!`;
        }
        if (!checkmateState.active) {
          triggerCheckmateSequence(currentTurn, winnerColor);
        }
      } else {
        const turnLabel = currentTurn === 'w' ? 'Vez das Brancas' : 'Vez das Pretas';
        const aiColor = playerColor === 'w' ? 'b' : 'w';
        const isAiTurn = !scriptedGameActive && gameMode === 'single' && currentTurn === aiColor;

        if (activeChainSquare) {
          if (turnText) {
            turnText.textContent = `${turnLabel} (Continue a Captura!)`;
          }
        } else if (lastAssoproNotice) {
          if (turnText) {
            turnText.textContent = `${lastAssoproNotice} • ${turnLabel}`;
          }
        } else if (isAiTurn) {
          if (turnText) {
            turnText.textContent = `${turnLabel} (IA pensando...)`;
          }
        } else if (hasCaptureAvailable) {
          if (turnText) {
            turnText.textContent = `${turnLabel} • Captura Disponível (Não comer = Assoprada!)`;
          }
        } else if (turnText) {
          turnText.textContent = turnLabel;
        }

        // Se for a vez do jogador humano e nenhuma peça estiver selecionada ainda, destaca pedras que podem comer
        if (!isAiTurn && !selectedSquare && hasCaptureAvailable && !isAnimatingMove) {
          clearSquareHighlights();
          showMandatoryCaptureHints(legalMoves);
        }
      }

      if (modeBadge) {
        if (gameMode === 'local2p') {
          modeBadge.textContent = '2 Jogadores Local';
        } else {
          modeBadge.textContent = `Contra IA (${playerColor === 'w' ? 'Brancas' : 'Pretas'})`;
        }
      }

      if (btnModeToggle) {
        btnModeToggle.textContent = gameMode === 'local2p' ? 'Modo: 2 Jogadores' : 'Modo: Contra IA';
      }

      if (btnAiMove) {
        btnAiMove.style.display = 'inline-flex';
      }

      if (btnSideToggle) {
        btnSideToggle.style.display = gameMode === 'single' ? 'inline-flex' : 'none';
        btnSideToggle.textContent = playerColor === 'w' ? 'Jogar de Pretas' : 'Jogar de Brancas';
      }

      if (roomPill) {
        roomPill.style.display = 'none';
      }

      if (capturedTray) {
        // Count Damas on board for extra clarity
        let whiteDamas = 0;
        let blackDamas = 0;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.type === 'queen') {
              if (p.color === 'w') whiteDamas++;
              else blackDamas++;
            }
          }
        }
        const damaInfo =
          whiteDamas > 0 || blackDamas > 0
            ? `   •   Damas ♕ — Brancas: ${whiteDamas} | Pretas: ${blackDamas}`
            : '';
        capturedTray.textContent = `Capturadas — Brancas: ${capturedByWhite}/12  |  Pretas: ${capturedByBlack}/12${damaInfo}`;
      }

      updateHistorySidebarUI();
      if (typeof updateScriptBarUI === 'function') updateScriptBarUI();
    }

    function updateHistorySidebarUI() {
      const whiteCountEl = document.getElementById('hist-cap-white-count');
      const blackCountEl = document.getElementById('hist-cap-black-count');
      const whiteStonesEl = document.getElementById('hist-cap-white-stones');
      const blackStonesEl = document.getElementById('hist-cap-black-stones');
      const assopradasBadgeEl = document.getElementById('assopradas-count-badge');
      const assopradasListEl = document.getElementById('assopradas-list');
      const movesBadgeEl = document.getElementById('moves-count-badge');
      const movesListEl = document.getElementById('moves-history-list');

      // Contabilizar quantas pedras de cada cor foram assopradas
      const blackBlownCount = assopradasHistory.filter((a) => a.color === 'b').length;
      const whiteBlownCount = assopradasHistory.filter((a) => a.color === 'w').length;

      if (whiteCountEl) {
        whiteCountEl.innerHTML = `${capturedByWhite} <small>/ 12</small>`;
      }
      if (blackCountEl) {
        blackCountEl.innerHTML = `${capturedByBlack} <small>/ 12</small>`;
      }

      if (whiteStonesEl) {
        let pipsHtml = '';
        for (let i = 0; i < Math.min(12, capturedByWhite); i++) {
          const isAssoprada = i >= capturedByWhite - blackBlownCount;
          pipsHtml += `<span class="mini-stone-pip captured-b${isAssoprada ? ' assoprada-pip' : ''}" title="${isAssoprada ? 'Pedra Preta Assoprada' : 'Pedra Preta Capturada'}"></span>`;
        }
        whiteStonesEl.innerHTML = pipsHtml;
      }

      if (blackStonesEl) {
        let pipsHtml = '';
        for (let i = 0; i < Math.min(12, capturedByBlack); i++) {
          const isAssoprada = i >= capturedByBlack - whiteBlownCount;
          pipsHtml += `<span class="mini-stone-pip captured-w${isAssoprada ? ' assoprada-pip' : ''}" title="${isAssoprada ? 'Pedra Branca Assoprada' : 'Pedra Branca Capturada'}"></span>`;
        }
        blackStonesEl.innerHTML = pipsHtml;
      }

      if (assopradasBadgeEl) {
        assopradasBadgeEl.textContent = String(assopradasHistory.length);
      }

      if (assopradasListEl) {
        if (assopradasHistory.length === 0) {
          assopradasListEl.innerHTML =
            '<div class="history-empty-msg">Nenhuma pedra assoprada ainda. Deixar de comer elimina a pedra!</div>';
        } else {
          assopradasListEl.innerHTML = assopradasHistory
            .slice()
            .reverse()
            .map(
              (item) => `
              <div class="assoprada-item">
                <div class="assoprada-item-left">
                  <span class="capture-dot ${item.color === 'w' ? 'white' : 'black'}"></span>
                  <span class="assoprada-wind-tag">💨 Assoprada</span>
                  <span class="assoprada-desc">${item.pieceLabel}</span>
                </div>
                <span class="assoprada-sq" title="Lance #${item.moveNumber} na casa ${item.square}">#${item.moveNumber} • ${item.square}</span>
              </div>`
            )
            .join('');
        }
      }

      if (movesBadgeEl) {
        movesBadgeEl.textContent = String(moveHistory.length);
      }

      if (movesListEl) {
        if (moveHistory.length === 0) {
          movesListEl.innerHTML =
            '<div class="history-empty-msg">Clique em uma pedra para iniciar a partida.</div>';
        } else {
          movesListEl.innerHTML = moveHistory
            .slice()
            .reverse()
            .map((entry, revIdx) => {
              const mv = entry.move || {};
              const moveNum = mv.moveNumber || moveHistory.length - revIdx;
              const fromSq = mv.fromSq || coordToSquareName(mv.fromR ?? 0, mv.fromC ?? 0);
              const toSq = mv.toSq || coordToSquareName(mv.toR ?? 0, mv.toC ?? 0);
              const sep = mv.capture ? '×' : '→';
              const rowCls = [
                'move-log-row',
                mv.capture ? 'is-capture' : '',
                mv.assoprada ? 'is-assoprada' : ''
              ]
                .filter(Boolean)
                .join(' ');

              let tagsHtml = '';
              if (mv.capture) {
                tagsHtml += `<span class="move-tag capture" title="Comeu pedra em ${mv.capturedSq || ''}">× ${mv.capturedSq || 'Comida'}</span>`;
              }
              if (mv.crowned) {
                tagsHtml += `<span class="move-tag dama">♕ Dama</span>`;
              }
              if (mv.assoprada) {
                tagsHtml += `<span class="move-tag assoprada" title="${mv.assoprada.pieceLabel} assoprada em ${mv.assoprada.square}">💨 ${mv.assoprada.square}</span>`;
              }

              return `
              <div class="${rowCls}">
                <div class="move-log-left">
                  <span class="move-log-num">#${moveNum}</span>
                  <span class="capture-dot ${mv.color === 'w' ? 'white' : 'black'}"></span>
                  <span class="move-log-coord">${fromSq} ${sep} ${toSq}</span>
                </div>
                <div class="move-log-tags">${tagsHtml}</div>
              </div>`;
            })
            .join('');
        }
      }
    }

    // =========================================================================
    // Raycasting & Board Interaction (Damas Brasileiras)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;
      if (isAnimatingMove || gameOver) return;

      // Enforce turn ownership in Online Multiplayer, and in Single Player only block while AI auto-move timer is actively pending
      if (gameMode === 'multi' && currentTurn !== playerColor) return;
      if (!scriptedGameActive && gameMode === 'single' && currentTurn !== playerColor && aiTimer !== null) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const pieceMeshes = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (boardState[r][c] && boardState[r][c].mesh) {
            pieceMeshes.push(boardState[r][c].mesh);
          }
        }
      }

      const hits = raycaster.intersectObjects([...pieceMeshes, ...boardSquareMeshes], true);
      if (hits.length === 0) {
        if (activeChainSquare) return; // Don't deselect during an active multi-capture chain
        if (preMoveHighlightTask) preMoveHighlightTask = null;
        clearSquareHighlights();
        selectedSquare = null;
        validMoves = [];
        updateTurnUI();
        return;
      }

      let clickedR = -1;
      let clickedC = -1;
      let obj = hits[0].object;
      while (obj) {
        if (obj.userData && obj.userData.piece) {
          clickedR = obj.userData.piece.r;
          clickedC = obj.userData.piece.c;
          break;
        }
        if (obj.userData && obj.userData.isSquare) {
          clickedR = obj.userData.r;
          clickedC = obj.userData.c;
          break;
        }
        obj = obj.parent;
      }

      if (clickedR === -1) return;

      if (preMoveHighlightTask) {
        preMoveHighlightTask = null;
      }

      // If in the middle of a multi-capture chain, keep activeChainSquare locked
      if (activeChainSquare && (!selectedSquare || selectedSquare.r !== activeChainSquare.r || selectedSquare.c !== activeChainSquare.c)) {
        selectedSquare = { r: activeChainSquare.r, c: activeChainSquare.c };
        validMoves = getLegalMovesForPiece(activeChainSquare.r, activeChainSquare.c);
      }

      if (selectedSquare) {
        const move = validMoves.find((m) => m.r === clickedR && m.c === clickedC);
        if (move) {
          executeChessMove(selectedSquare.r, selectedSquare.c, move.r, move.c);
          return;
        }
      }

      // During a multi-capture chain, only the capturing piece can be selected
      if (activeChainSquare) {
        selectedSquare = { r: activeChainSquare.r, c: activeChainSquare.c };
        validMoves = getLegalMovesForPiece(activeChainSquare.r, activeChainSquare.c);
        showSquareHighlights(activeChainSquare.r, activeChainSquare.c, validMoves);
        return;
      }

      const clickedPiece = boardState[clickedR][clickedC];
      if (clickedPiece && clickedPiece.color === currentTurn) {
        selectedSquare = { r: clickedR, c: clickedC };
        validMoves = getLegalMovesForPiece(clickedR, clickedC);
        showSquareHighlights(clickedR, clickedC, validMoves);
        playSelectSound(clickedPiece.type === 'queen');
      } else {
        clearSquareHighlights();
        selectedSquare = null;
        validMoves = [];
        updateTurnUI();
      }
    });

    // =========================================================================
    // Multiplayer Room Synchronization (Same-Origin API + Static Site Fallback)
    // =========================================================================
    const CLOUD_MP_API_BASE = '';
    const isStaticHost =
      window.location.hostname.includes('zipline') ||
      window.location.hostname.includes('github.io') ||
      window.location.protocol === 'file:';

    let staticBroadcastChannel = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        staticBroadcastChannel = new BroadcastChannel('wizard_chess_mp_channel');
        staticBroadcastChannel.onmessage = (ev) => {
          const msg = ev.data;
          if (msg && msg.type === 'room_state' && msg.room && msg.room.code === roomCode) {
            applyRemoteRoomState(msg.room);
          }
        };
      }
    } catch (e) {}

    window.addEventListener('storage', (ev) => {
      if (ev.key === `wizard_chess_room_${roomCode}` && ev.newValue) {
        try {
          applyRemoteRoomState(JSON.parse(ev.newValue));
        } catch (e) {}
      }
    });

    function getStaticRoom(code) {
      try {
        const raw = localStorage.getItem(`wizard_chess_room_${code}`);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function saveAndBroadcastStaticRoom(room) {
      try {
        localStorage.setItem(`wizard_chess_room_${room.code}`, JSON.stringify(room));
      } catch (e) {}
      try {
        if (staticBroadcastChannel) {
          staticBroadcastChannel.postMessage({ type: 'room_state', room });
        }
      } catch (e) {}
    }

    function ensurePlayerToken() {
      if (!playerToken) {
        playerToken = 'tok_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        try {
          localStorage.setItem('wizard_chess_token', playerToken);
        } catch (e) {}
      }
      return playerToken;
    }

    async function mpApiRequest(apiPath, options = {}) {
      const bases = isStaticHost
        ? (CLOUD_MP_API_BASE ? [CLOUD_MP_API_BASE] : [])
        : (CLOUD_MP_API_BASE ? ['', CLOUD_MP_API_BASE] : ['']);
      for (const base of bases) {
        try {
          const res = await fetch(`${base}${apiPath}`, options);
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              return await res.json();
            }
          }
        } catch (e) {}
      }
      return null;
    }

    async function sendMultiplayerMove(movePayload) {
      if (!roomCode) return;
      const stRoom = getStaticRoom(roomCode);
      if (stRoom) {
        stRoom.moves = stRoom.moves || [];
        stRoom.moves.push({
          seq: stRoom.moves.length + 1,
          color: movePayload.color,
          from: movePayload.from,
          to: movePayload.to,
          promotion: movePayload.promotion || 'queen',
          ts: Date.now()
        });
        stRoom.turn = movePayload.color === 'w' ? 'b' : 'w';
        stRoom.updatedAt = Date.now();
        saveAndBroadcastStaticRoom(stRoom);
      }
      await mpApiRequest(`/api/rooms/${roomCode}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movePayload)
      });
    }

    function stopMultiplayerSync() {
      if (roomEventSource) {
        roomEventSource.close();
        roomEventSource = null;
      }
      if (roomPollTimer) {
        clearInterval(roomPollTimer);
        roomPollTimer = null;
      }
    }

    function applyRemoteRoomState(room) {
      if (!room) return;
      const statusEl = document.getElementById('hud-room-status');
      const bothReady = room.whiteJoined && room.blackJoined;
      if (statusEl) {
        statusEl.textContent = bothReady ? '2/2 Conectados' : 'Aguardando Oponente';
      }
      const mpMsg = document.getElementById('mp-status-msg');
      if (mpMsg && roomCode) {
        mpMsg.textContent = bothReady
          ? `Ambos os jogadores conectados na Sala ${room.code}!`
          : `Sala ${room.code} pronta — aguardando o segundo jogador...`;
      }

      if (room.resetCount > appliedResetCount) {
        appliedResetCount = room.resetCount;
        appliedMoveSeq = 0;
        resetChessBoard(false);
      }

      if (Array.isArray(room.moves) && room.moves.length > appliedMoveSeq) {
        const tryApplyNext = () => {
          if (isAnimatingMove) {
            setTimeout(tryApplyNext, 120);
            return;
          }
          if (appliedMoveSeq >= room.moves.length) return;
          const nextMove = room.moves[appliedMoveSeq];
          appliedMoveSeq = nextMove.seq || (appliedMoveSeq + 1);
          const pieceAtFrom = boardState[nextMove.from.r]?.[nextMove.from.c];
          if (pieceAtFrom) {
            executeChessMove(
              nextMove.from.r,
              nextMove.from.c,
              nextMove.to.r,
              nextMove.to.c,
              { fromRemote: true }
            );
          }
          if (appliedMoveSeq < room.moves.length) {
            setTimeout(tryApplyNext, 250);
          }
        };
        tryApplyNext();
      }
    }

    function startMultiplayerSync(code) {
      stopMultiplayerSync();
      roomCode = code;

      if (!isStaticHost) {
        try {
          roomEventSource = new EventSource(`/api/rooms/${code}/events`);
          roomEventSource.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data);
              if (data.room) applyRemoteRoomState(data.room);
            } catch (e) {}
          };
        } catch (e) {}
      }

      roomPollTimer = setInterval(async () => {
        if (gameMode !== 'multi' || !roomCode) return;
        const data = await mpApiRequest(
          `/api/rooms/${roomCode}/state?playerToken=${encodeURIComponent(playerToken)}`
        );
        if (data && data.ok && data.room) {
          saveAndBroadcastStaticRoom(data.room);
          applyRemoteRoomState(data.room);
          return;
        }
        const stRoom = getStaticRoom(roomCode);
        if (stRoom) {
          applyRemoteRoomState(stRoom);
        }
      }, 1500);
    }

    async function createMultiplayerRoom(preferredColor) {
      const mpMsg = document.getElementById('mp-status-msg');
      if (mpMsg) mpMsg.textContent = 'Criando sala...';
      ensurePlayerToken();

      let data = await mpApiRequest('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredColor, playerToken })
      });

      if (!data || !data.ok) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let genCode = '';
        for (let i = 0; i < 4; i++) {
          genCode += chars[Math.floor(Math.random() * chars.length)];
        }
        const side = preferredColor === 'b' ? 'b' : 'w';
        const staticRoom = {
          code: genCode,
          status: 'waiting',
          whiteJoined: side === 'w',
          blackJoined: side === 'b',
          turn: 'w',
          moves: [],
          resetCount: 0,
          updatedAt: Date.now()
        };
        saveAndBroadcastStaticRoom(staticRoom);
        data = {
          ok: true,
          code: genCode,
          color: side,
          playerToken,
          room: staticRoom
        };
      } else if (data.room) {
        saveAndBroadcastStaticRoom(data.room);
      }

      playerToken = data.playerToken;
      try {
        localStorage.setItem('wizard_chess_token', playerToken);
      } catch (e) {}
      scriptedGameActive = false;
      gameMode = 'multi';
      playerColor = data.color;
      roomCode = data.code;
      appliedMoveSeq = 0;
      appliedResetCount = data.room.resetCount || 0;

      const modalCodeEl = document.getElementById('modal-room-code');
      if (modalCodeEl) modalCodeEl.textContent = roomCode;
      const createdPanelEl = document.getElementById('room-created-panel');
      if (createdPanelEl) createdPanelEl.style.display = 'block';

      resetChessBoard(true);
      startMultiplayerSync(roomCode);
      applyRemoteRoomState(data.room);
      window.history.replaceState({}, '', `?room=${roomCode}`);
    }

    async function joinMultiplayerRoom(codeInput) {
      const code = String(codeInput || '').trim().toUpperCase();
      const mpMsg = document.getElementById('mp-status-msg');
      if (!code) {
        if (mpMsg) mpMsg.textContent = 'Digite o código de 4 letras da sala.';
        return false;
      }
      if (mpMsg) mpMsg.textContent = `Entrando na sala ${code}...`;
      ensurePlayerToken();

      let data = await mpApiRequest('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, playerToken })
      });

      if (!data || !data.ok) {
        let stRoom = getStaticRoom(code);
        if (!stRoom) {
          stRoom = {
            code,
            status: 'playing',
            whiteJoined: true,
            blackJoined: true,
            turn: 'w',
            moves: [],
            resetCount: 0,
            updatedAt: Date.now()
          };
        } else {
          if (!stRoom.whiteJoined) stRoom.whiteJoined = true;
          else if (!stRoom.blackJoined) stRoom.blackJoined = true;
          stRoom.status = stRoom.whiteJoined && stRoom.blackJoined ? 'playing' : 'waiting';
          stRoom.updatedAt = Date.now();
        }
        const assignedColor = !stRoom.blackJoined ? 'w' : 'b';
        saveAndBroadcastStaticRoom(stRoom);
        data = {
          ok: true,
          code,
          color: assignedColor,
          playerToken,
          room: stRoom
        };
      } else if (data.room) {
        saveAndBroadcastStaticRoom(data.room);
      }

      playerToken = data.playerToken;
      try {
        localStorage.setItem('wizard_chess_token', playerToken);
      } catch (e) {}
      scriptedGameActive = false;
      gameMode = 'multi';
      playerColor = data.color;
      roomCode = data.code;
      appliedMoveSeq = 0;
      appliedResetCount = data.room.resetCount || 0;

      resetChessBoard(true);
      startMultiplayerSync(roomCode);
      applyRemoteRoomState(data.room);
      window.history.replaceState({}, '', `?room=${roomCode}`);
      closeLobbyModal();
      return true;
    }

    // =========================================================================
    // Camera Presets & HUD Controls
    // =========================================================================
    const camButtons = [
      'btn-cam-player',
      'btn-cam-top',
      'btn-cam-side',
      'btn-cam-wide'
    ];

    function setActiveCamButton(activeId) {
      for (const id of camButtons) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === activeId);
      }
    }

    let playerCamSide = 'w';
    let overheadCamSide = 'w';
    let sideCamSide = 'east';
    let cathedralWideSide = 'north';

    function setCameraPose(posArr, targetArr) {
      activeCamTransition = null;
      if (Array.isArray(posArr) && posArr.length === 3) {
        camera.position.set(posArr[0], posArr[1], posArr[2]);
      }
      if (Array.isArray(targetArr) && targetArr.length === 3) {
        orbitControls.target.set(targetArr[0], targetArr[1], targetArr[2]);
      }
      enforceCathedralBoundsAndSolidColumns(null, camera.position, orbitControls.target);
      flushOrbitControlsDamping();
    }

    function setCameraPreset(preset) {
      if (preset === 'player') {
        const wasPlayerActive = document.getElementById('btn-cam-player')?.classList.contains('active');
        if (wasPlayerActive) {
          playerCamSide = playerCamSide === 'w' ? 'b' : 'w';
        } else {
          playerCamSide = playerColor === 'b' ? 'b' : 'w';
        }
        setActiveCamButton('btn-cam-player');
        setCameraForSide(playerCamSide, false);
      } else if (preset === 'top') {
        const wasTopActive = document.getElementById('btn-cam-top')?.classList.contains('active');
        if (wasTopActive) {
          overheadCamSide = overheadCamSide === 'w' ? 'b' : 'w';
        } else {
          overheadCamSide = playerColor === 'b' ? 'b' : 'w';
        }
        setActiveCamButton('btn-cam-top');
        const zSign = overheadCamSide === 'b' ? -1 : 1;
        smoothCameraTo(new THREE.Vector3(0, 6.85, zSign * 3.65), new THREE.Vector3(0, 0.78, 0), 0.75);
      } else if (preset === 'side') {
        const wasSideActive = document.getElementById('btn-cam-side')?.classList.contains('active');
        if (wasSideActive) {
          sideCamSide = sideCamSide === 'east' ? 'west' : 'east';
        } else {
          sideCamSide = 'east';
        }
        setActiveCamButton('btn-cam-side');
        const xSign = sideCamSide === 'west' ? -1 : 1;
        smoothCameraTo(new THREE.Vector3(xSign * 2.85, 1.85, 0), new THREE.Vector3(0, 0.84, 0), 0.75);
      } else if (preset === 'wide') {
        const wasWideActive = document.getElementById('btn-cam-wide')?.classList.contains('active');
        if (wasWideActive) {
          cathedralWideSide = cathedralWideSide === 'north' ? 'south' : 'north';
        } else {
          cathedralWideSide = playerColor === 'b' ? 'south' : 'north';
        }
        setActiveCamButton('btn-cam-wide');
        if (cathedralWideSide === 'south') {
          smoothCameraTo(new THREE.Vector3(0, 2.55, -6.65), new THREE.Vector3(0, 1.95, 2.50), 0.85);
        } else {
          smoothCameraTo(new THREE.Vector3(0, 2.55, 6.65), new THREE.Vector3(0, 1.95, -2.50), 0.85);
        }
      } else if (preset === 'white_backdrop') {
        smoothCameraTo(new THREE.Vector3(0, 2.35, -3.10), new THREE.Vector3(0, 2.20, 8.50), 0.85);
      } else if (preset === 'vaults') {
        smoothCameraTo(new THREE.Vector3(-1.60, 2.65, 3.20), new THREE.Vector3(2.20, 7.60, -9.50), 0.85);
      } else if (preset === 'side_windows') {
        smoothCameraTo(new THREE.Vector3(-1.40, 2.30, 0.60), new THREE.Vector3(5.20, 4.10, -5.80), 0.85);
      } else if (preset === 'back_windows') {
        smoothCameraTo(new THREE.Vector3(0, 3.40, -7.80), new THREE.Vector3(0, 4.60, -18.10), 0.85);
      } else if (preset === 'rear_windows') {
        smoothCameraTo(new THREE.Vector3(0, 3.40, 7.80), new THREE.Vector3(0, 4.60, 18.10), 0.85);
      }
    }

    document.getElementById('btn-cam-player')?.addEventListener('click', () => setCameraPreset('player'));
    document.getElementById('btn-cam-top')?.addEventListener('click', () => setCameraPreset('top'));
    document.getElementById('btn-cam-side')?.addEventListener('click', () => setCameraPreset('side'));
    document.getElementById('btn-cam-wide')?.addEventListener('click', () => setCameraPreset('wide'));
    document.getElementById('btn-sound-toggle')?.addEventListener('click', () => toggleSound());
    document.getElementById('btn-hide-ui')?.addEventListener('click', () => toggleUI());

    document.getElementById('btn-script-modal')?.addEventListener('click', () => openLobbyModal('script'));
    document.getElementById('btn-script-prev')?.addEventListener('click', () => stepScriptBackward());
    document.getElementById('btn-script-next')?.addEventListener('click', () => stepScriptForward());

    document.getElementById('btn-mode-toggle')?.addEventListener('click', () => {
      stopMultiplayerSync();
      scriptedGameActive = false;
      gameMode = gameMode === 'single' ? 'local2p' : 'single';
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      updateTurnUI();
      if (gameMode === 'single') {
        maybeScheduleAIMove();
      }
    });

    document.getElementById('btn-ai-move')?.addEventListener('click', () => {
      triggerAIMoveNow();
    });

    document.getElementById('btn-side-toggle')?.addEventListener('click', () => {
      if (gameMode !== 'single') {
        gameMode = 'single';
      }
      playerColor = playerColor === 'w' ? 'b' : 'w';
      resetChessBoard(true, false);
    });

    document.getElementById('btn-reset')?.addEventListener('click', async () => {
      if (gameMode === 'multi' && roomCode) {
        const stRoom = getStaticRoom(roomCode);
        if (stRoom) {
          stRoom.moves = [];
          stRoom.turn = 'w';
          stRoom.resetCount = (stRoom.resetCount || 0) + 1;
          stRoom.updatedAt = Date.now();
          saveAndBroadcastStaticRoom(stRoom);
          applyRemoteRoomState(stRoom);
        }
        await mpApiRequest(`/api/rooms/${roomCode}/reset`, { method: 'POST' });
      } else {
        resetChessBoard(true, false);
      }
    });

    // =========================================================================
    // Lobby & Director Script Modal Interactions
    // =========================================================================
    const lobbyModal = document.getElementById('lobby-modal');
    let selectedSpColor = 'w';
    let selectedMpColor = 'w';

    function openLobbyModal(tab = null) {
      lobbyModal?.classList.add('open');
      if (tab === 'multi') switchLobbyTab('multi');
      else if (tab === 'script') switchLobbyTab('script');
      else if (tab === 'single') switchLobbyTab('single');
    }

    function closeLobbyModal() {
      lobbyModal?.classList.remove('open');
    }

    function switchLobbyTab(tab) {
      const isSingle = tab === 'single';
      const isMulti = tab === 'multi';
      const isScript = tab === 'script';
      document.getElementById('tab-single')?.classList.toggle('active', isSingle);
      document.getElementById('tab-multi')?.classList.toggle('active', isMulti);
      document.getElementById('tab-script')?.classList.toggle('active', isScript);
      const pSingle = document.getElementById('panel-single');
      const pMulti = document.getElementById('panel-multi');
      const pScript = document.getElementById('panel-script');
      if (pSingle) pSingle.style.display = isSingle ? 'block' : 'none';
      if (pMulti) pMulti.style.display = isMulti ? 'block' : 'none';
      if (pScript) pScript.style.display = isScript ? 'block' : 'none';
    }

    document.getElementById('btn-lobby')?.addEventListener('click', () => openLobbyModal());
    document.getElementById('btn-close-lobby')?.addEventListener('click', closeLobbyModal);
    document.getElementById('tab-single')?.addEventListener('click', () => switchLobbyTab('single'));
    document.getElementById('tab-multi')?.addEventListener('click', () => switchLobbyTab('multi'));
    document.getElementById('tab-script')?.addEventListener('click', () => switchLobbyTab('script'));

    document.getElementById('btn-preset-scandi')?.addEventListener('click', () => {
      const el = document.getElementById('input-notation');
      if (el) el.value = DEFAULT_DIRECTOR_NOTATION;
    });

    document.getElementById('btn-load-notation')?.addEventListener('click', () => {
      const val = document.getElementById('input-notation')?.value || '';
      const res = loadNotationScript(val, { orientCamera: false });
      if (res.ok) {
        closeLobbyModal();
      }
    });

    document.getElementById('pick-sp-white')?.addEventListener('click', () => {
      selectedSpColor = 'w';
      document.getElementById('pick-sp-white')?.classList.add('selected');
      document.getElementById('pick-sp-black')?.classList.remove('selected');
    });
    document.getElementById('pick-sp-black')?.addEventListener('click', () => {
      selectedSpColor = 'b';
      document.getElementById('pick-sp-black')?.classList.add('selected');
      document.getElementById('pick-sp-white')?.classList.remove('selected');
    });

    document.getElementById('btn-start-single')?.addEventListener('click', () => {
      stopMultiplayerSync();
      scriptedGameActive = false;
      gameMode = 'single';
      roomCode = null;
      playerColor = selectedSpColor;
      window.history.replaceState({}, '', window.location.pathname);
      closeLobbyModal();
      resetChessBoard(true);
    });

    document.getElementById('pick-mp-white')?.addEventListener('click', () => {
      selectedMpColor = 'w';
      document.getElementById('pick-mp-white')?.classList.add('selected');
      document.getElementById('pick-mp-black')?.classList.remove('selected');
    });
    document.getElementById('pick-mp-black')?.addEventListener('click', () => {
      selectedMpColor = 'b';
      document.getElementById('pick-mp-black')?.classList.add('selected');
      document.getElementById('pick-mp-white')?.classList.remove('selected');
    });

    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      createMultiplayerRoom(selectedMpColor);
    });

    document.getElementById('btn-enter-created-room')?.addEventListener('click', () => {
      closeLobbyModal();
    });

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      if (!roomCode) return;
      navigator.clipboard?.writeText(roomCode);
      const el = document.getElementById('mp-status-msg');
      if (el) el.textContent = `Código ${roomCode} copiado!`;
    });

    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
      if (!roomCode) return;
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      navigator.clipboard?.writeText(inviteUrl);
      const el = document.getElementById('mp-status-msg');
      if (el) el.textContent = 'Link de convite copiado!';
    });

    document.getElementById('room-pill')?.addEventListener('click', () => {
      openLobbyModal('multi');
    });

    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      const val = document.getElementById('input-room-code')?.value || '';
      joinMultiplayerRoom(val);
    });

    document.getElementById('input-room-code')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        joinMultiplayerRoom(e.target.value);
      }
    });

    document.getElementById('btn-checkmate-stepback')?.addEventListener('click', () => {
      stepScriptBackward();
    });
    document.getElementById('btn-checkmate-replay')?.addEventListener('click', () => {
      const defCol = checkmateState.defeatedColor || currentTurn;
      const winCol = checkmateState.winnerColor || (defCol === 'w' ? 'b' : 'w');
      triggerCheckmateSequence(defCol, winCol);
    });
    document.getElementById('btn-checkmate-newgame')?.addEventListener('click', () => {
      resetChessBoard(true, false);
    });
    document.getElementById('btn-checkmate-dismiss')?.addEventListener('click', () => {
      const overlay = document.getElementById('checkmate-overlay');
      if (overlay) overlay.classList.remove('visible');
      checkmateState.bannerVisible = false;
    });

    // =========================================================================
    // Programmatic API for Automated Verification & Camera Inspection
    // =========================================================================
    window.wizardChess = {
      setCameraPreset,
      setCameraPose,
      setCameraLook: setCameraPose,
      setCameraKeySpeedPercent,
      setCameraRotSpeedPercent,
      setWallStoneLook,
      nextWallStoneLook,
      prevWallStoneLook,
      setFloorStoneLook,
      nextFloorStoneLook,
      prevFloorStoneLook,
      WALL_STONE_LOOKS,
      FLOOR_STONE_LOOKS,
      holdCameraKey: (code, down = true) => {
        if (down) heldCameraKeys.add(code);
        else heldCameraKeys.delete(code);
      },
      executeChessMove,
      triggerAIMoveNow,
      resetChessBoard,
      openLobbyModal,
      closeLobbyModal,
      toggleUI,
      toggleSound,
      loadNotation: (pgn, opts) => loadNotationScript(pgn, opts),
      stepScriptForward,
      stepScriptBackward,
      triggerCheckmateSequence,
      setGameMode: (mode) => {
        gameMode = mode === 'local2p' ? 'local2p' : 'single';
        if (aiTimer) {
          clearTimeout(aiTimer);
          aiTimer = null;
        }
        updateTurnUI();
      },
      testColumnCollisionSlide: (startArr, endArr, steps = 20) => {
        activeCamTransition = null;
        camera.position.set(startArr[0], startArr[1], startArr[2]);
        const path = [];
        for (let i = 1; i <= steps; i++) {
          const u = i / steps;
          const prev = camera.position.clone();
          camera.position.set(
            startArr[0] + (endArr[0] - startArr[0]) * u,
            startArr[1] + (endArr[1] - startArr[1]) * u,
            startArr[2] + (endArr[2] - startArr[2]) * u
          );
          enforceCathedralBoundsAndSolidColumns(prev, camera.position, orbitControls.target);
          path.push(camera.position.toArray().map((v) => Number(v.toFixed(3))));
        }
        renderer.render(scene, camera);
        return path;
      },
      setSinglePlayerSide: (color) => {
        stopMultiplayerSync();
        scriptedGameActive = false;
        gameMode = 'single';
        playerColor = color === 'b' ? 'b' : 'w';
        resetChessBoard(true, false);
      },
      setupCustomScenario: (pieces, turn = 'w') => {
        stopMultiplayerSync();
        if (aiTimer) {
          clearTimeout(aiTimer);
          aiTimer = null;
        }
        activeMoveTweens.length = 0;
        isAnimatingMove = false;
        gameOver = false;
        scriptedGameActive = false;
        scriptDeviated = false;
        preMoveHighlightTask = null;
        activeChainSquare = null;
        chainCapturedSet.clear();
        clearCheckmateSequence();
        clearSquareHighlights();
        clearAllPieces();
        for (const p of pieces) {
          const inst = instantiatePiece(p.type, p.color, p.r, p.c);
          inst.hasMoved = Boolean(p.hasMoved);
          boardState[p.r][p.c] = inst;
        }
        currentTurn = turn;
        updateTurnUI();
        renderer.render(scene, camera);
      },
      triggerDemoCapture: () => {
        // Demonstração de salto de captura nas Damas Brasileiras:
        // Pedra branca em (4, 3) salta sobre pedra preta em (3, 4) pousando em (2, 5)
        window.wizardChess.setupCustomScenario(
          [
            { type: 'pawn', color: 'w', r: 4, c: 3 },
            { type: 'pawn', color: 'b', r: 3, c: 4 },
            { type: 'pawn', color: 'b', r: 0, c: 1 }
          ],
          'w'
        );
        return executeChessMove(4, 3, 2, 5);
      },
      getState: () => {
        let whitePawns = 0;
        let blackPawns = 0;
        let whiteDamas = 0;
        let blackDamas = 0;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (!p) continue;
            if (p.color === 'w') {
              if (p.type === 'queen') whiteDamas++;
              else whitePawns++;
            } else {
              if (p.type === 'queen') blackDamas++;
              else blackPawns++;
            }
          }
        }
        const currentLegals = getAllLegalMoves(currentTurn);
        return {
          gameMode,
          scriptedGameActive,
          scriptDeviated,
          scriptMovesCount: scriptMoves.length,
          scriptCursor,
          moveHistoryCount: moveHistory.length,
          preMoveHighlightActive: Boolean(preMoveHighlightTask),
          selectedSquare,
          activeChainSquare,
          validMovesCount: validMoves.length,
          legalMovesCount: currentLegals.length,
          mandatoryCaptureActive: currentLegals.some((m) => m.capture),
          assopradaCount,
          lastAssoproNotice,
          whitePawns,
          blackPawns,
          whiteDamas,
          blackDamas,
          soundEnabled,
          activeParticleBurstsCount: magicParticleSystems.length,
          highlightMeshCount: squareHighlightsGroup.children.length,
          uiHidden: document.body.classList.contains('cinematic-ui-hidden'),
          playerColor,
          currentTurn,
          roomCode,
          isAnimatingMove,
          gameOver,
          checkmateState: { ...checkmateState },
          capturedByWhite,
          capturedByBlack,
          cameraPos: camera.position.toArray(),
          cameraTarget: orbitControls.target.toArray(),
          playerCamSide,
          overheadCamSide,
          sideCamSide,
          cathedralWideSide,
          cameraKeySpeedPct,
          cameraRotSpeedPct,
          wallStoneLookIndex: currentWallStoneLookIdx,
          wallStoneLookName: WALL_STONE_LOOKS[currentWallStoneLookIdx]?.name || '',
          floorStoneLookIndex: currentFloorStoneLookIdx,
          floorStoneLookName: FLOOR_STONE_LOOKS[currentFloorStoneLookIdx]?.name || '',
          floorMaterialRoughness: cathedralFloorMats[0]?.roughness ?? null,
          floorMaterialMetalness: cathedralFloorMats[0]?.metalness ?? null,
          keyMoveVelocity: keyMoveVelocity.toArray().map((v) => Number(v.toFixed(4))),
          keyRotVelocity: {
            yaw: Number(keyRotVelocity.yaw.toFixed(4)),
            pitch: Number(keyRotVelocity.pitch.toFixed(4))
          },
          cathedralBounds: CATHEDRAL_BOUNDS,
          solidColumnsCount: CATHEDRAL_SOLID_PILLARS.filter((p) => p.isColumn).length,
          brazierPillars: CATHEDRAL_SOLID_PILLARS.filter((p) => !p.isColumn),
          telemetry: cameraTelemetry
        };
      },
      captureScreenshot: async (filename) => {
        renderer.render(scene, camera);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = renderer.domElement.width;
        outCanvas.height = renderer.domElement.height;
        const ctx = outCanvas.getContext('2d');
        ctx.drawImage(renderer.domElement, 0, 0);

        const scale = outCanvas.width / window.innerWidth;

        // Draw Gothic Cathedral Checkmate Banner if active
        if (checkmateState.bannerVisible) {
          ctx.save();
          ctx.scale(scale, scale);
          const bw = 560;
          const bh = 168;
          const bx = (window.innerWidth - bw) / 2;
          const by = 84;

          ctx.fillStyle = 'rgba(10, 12, 20, 0.94)';
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.88)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 6);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = 'rgba(212, 175, 55, 0.38)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx + 6, by + 6, bw - 12, bh - 12, 4);
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(212, 175, 55, 0.88)';
          ctx.font = '600 12px Georgia, serif';
          ctx.fillText('✦   SANCTUM JUDGMENT   ✦', window.innerWidth / 2, by + 28);

          ctx.fillStyle = '#f5d76e';
          ctx.font = '26px serif';
          const crownChar = checkmateState.winnerColor === 'b' ? '♚' : '♔';
          ctx.fillText(crownChar, window.innerWidth / 2, by + 56);

          ctx.fillStyle = '#f7e299';
          ctx.font = 'bold 40px Georgia, serif';
          ctx.fillText('C H E C K M A T E', window.innerWidth / 2, by + 102);

          ctx.strokeStyle = 'rgba(212, 175, 55, 0.65)';
          ctx.beginPath();
          ctx.moveTo(bx + 90, by + 116);
          ctx.lineTo(bx + bw - 90, by + 116);
          ctx.stroke();

          const subTxt =
            document.getElementById('checkmate-subtitle')?.textContent ||
            'WHITE TRIUMPHS • THE BLACK KING HAS FALLEN';
          ctx.fillStyle = '#f0ece1';
          ctx.font = 'bold 14px Georgia, serif';
          ctx.fillText(subTxt.toUpperCase(), window.innerWidth / 2, by + 142);
          ctx.restore();
        }

        // Only draw HUD summary bar if UI is NOT hidden by cinematic mode
        if (!document.body.classList.contains('cinematic-ui-hidden')) {
          ctx.save();
          ctx.scale(scale, scale);
          ctx.fillStyle = 'rgba(12, 15, 22, 0.82)';
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(16, 16, 520, 42, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#d4af37';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.fillText('WIZARD CHESS', 30, 42);

          const turnStr = document.getElementById('turn-text')?.textContent || '';
          const modeStr = document.getElementById('mode-badge')?.textContent || '';
          ctx.fillStyle = '#f0ece1';
          ctx.font = '600 13px Inter, sans-serif';
          ctx.fillText(`${turnStr}   |   ${modeStr}`, 155, 42);

          if (lobbyModal?.classList.contains('open')) {
            ctx.fillStyle = 'rgba(6, 8, 14, 0.72)';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
            const cw = 440;
            const ch = 290;
            const cx = (window.innerWidth - cw) / 2;
            const cy = (window.innerHeight - ch) / 2;
            ctx.fillStyle = 'rgba(14, 17, 26, 0.96)';
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cw, ch, 16);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#d4af37';
            ctx.font = 'bold 18px Inter, sans-serif';
            ctx.fillText('MULTIPLAYER LOBBY • ROOM CODE', cx + 28, cy + 42);

            ctx.fillStyle = '#9aa0a6';
            ctx.font = '13px Inter, sans-serif';
            ctx.fillText('Share this 4-character Room Code with Player 2:', cx + 28, cy + 82);

            ctx.fillStyle = '#f5d76e';
            ctx.font = 'bold 38px monospace';
            ctx.fillText(roomCode || '----', cx + 150, cy + 138);

            ctx.fillStyle = '#4ea8de';
            ctx.font = '600 14px Inter, sans-serif';
            ctx.fillText('Create Room  •  Join Room by Code  •  Live Move Sync', cx + 42, cy + 195);

            ctx.fillStyle = '#f0ece1';
            ctx.font = '13px Inter, sans-serif';
            ctx.fillText(`Host Assigned: ${playerColor === 'w' ? 'White' : 'Black'}  |  Status: Waiting for Opponent`, cx + 48, cy + 240);
          }
          ctx.restore();
        }

        const dataUrl = outCanvas.toDataURL('image/png');
        const res = await fetch('/api/upload-screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, filename })
        });
        return res.json();
      }
    };

    window.wizardChess.stepBy = (seconds, steps = 24) => {
      const subDt = seconds / steps;
      for (let i = 0; i < steps; i++) {
        stepScene(subDt, false);
      }
      renderer.render(scene, camera);
    };

    // =========================================================================
    // Main Animation Loop
    // =========================================================================
    let elapsedTotal = 0;
    function stepScene(dt, doRender = true) {
      elapsedTotal += dt;
      const prevCamPos = camera.position.clone();

      for (const mixer of activeMixers) {
        mixer.update(dt);
      }

      // Feature 3c: Advance pre-move piece selection & valid-squares highlight beat before executing scripted move
      if (preMoveHighlightTask && !isAnimatingMove) {
        preMoveHighlightTask.elapsedSim += dt;
        const wallElapsed = (performance.now() - preMoveHighlightTask.startWallMs) / 1000;
        if (
          preMoveHighlightTask.elapsedSim >= preMoveHighlightTask.duration ||
          wallElapsed >= preMoveHighlightTask.duration
        ) {
          const mv = preMoveHighlightTask.move;
          const fromScriptFlag = Boolean(preMoveHighlightTask.fromScript);
          preMoveHighlightTask = null;
          executeChessMove(mv.fromR, mv.fromC, mv.toR, mv.toC, { fromScript: fromScriptFlag });
        }
      }

      for (let i = activeMoveTweens.length - 1; i >= 0; i--) {
        const done = activeMoveTweens[i](dt);
        if (done) activeMoveTweens.splice(i, 1);
      }

      // Feature 4: Video-game style WASD + R/F camera translation AND Arrow-key camera rotation
      // with separate UI-configurable Move Speed & Rot Speed (both default 10%) and smooth ease-in / ease-out velocity damping
      if (!isAnimatingMove) {
        const moveSpeedScale = cameraKeySpeedPct / 100;
        const rotSpeedScale = cameraRotSpeedPct / 100;
        const maxMoveSpeed = 3.2 * moveSpeedScale; // 0.32 m/s at default 10%
        const maxVertSpeed = 2.6 * moveSpeedScale; // 0.26 m/s at default 10%
        const maxRotSpeed = 1.2 * rotSpeedScale;   // 0.12 rad/s at default 10%

        const forward = new THREE.Vector3().subVectors(orbitControls.target, camera.position);
        forward.y = 0;
        if (forward.lengthSq() < 1e-6) {
          camera.getWorldDirection(forward);
          forward.y = 0;
        }
        forward.normalize();
        const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();

        const horizDir = new THREE.Vector3(0, 0, 0);
        if (heldCameraKeys.has('KeyW')) horizDir.add(forward);
        if (heldCameraKeys.has('KeyS')) horizDir.sub(forward);
        if (heldCameraKeys.has('KeyD')) horizDir.add(right);
        if (heldCameraKeys.has('KeyA')) horizDir.sub(right);
        if (horizDir.lengthSq() > 1e-6) horizDir.normalize();

        const desiredMoveVel = horizDir.multiplyScalar(maxMoveSpeed);
        if (heldCameraKeys.has('KeyR')) desiredMoveVel.y += maxVertSpeed;
        if (heldCameraKeys.has('KeyF')) desiredMoveVel.y -= maxVertSpeed;

        let desiredYawVel = 0;
        let desiredPitchVel = 0;
        if (heldCameraKeys.has('ArrowLeft')) desiredYawVel += maxRotSpeed;
        if (heldCameraKeys.has('ArrowRight')) desiredYawVel -= maxRotSpeed;
        if (heldCameraKeys.has('ArrowUp')) desiredPitchVel += maxRotSpeed;
        if (heldCameraKeys.has('ArrowDown')) desiredPitchVel -= maxRotSpeed;

        // Smooth ease-in when keys are pressed and smooth ease-out when keys are released
        const easeAlpha = 1 - Math.exp(-Math.max(0.001, dt) * 7.5);
        keyMoveVelocity.lerp(desiredMoveVel, easeAlpha);
        keyRotVelocity.yaw += (desiredYawVel - keyRotVelocity.yaw) * easeAlpha;
        keyRotVelocity.pitch += (desiredPitchVel - keyRotVelocity.pitch) * easeAlpha;

        if (keyMoveVelocity.lengthSq() < 1e-8 && desiredMoveVel.lengthSq() === 0) {
          keyMoveVelocity.set(0, 0, 0);
        }
        if (Math.abs(keyRotVelocity.yaw) < 1e-5 && desiredYawVel === 0) keyRotVelocity.yaw = 0;
        if (Math.abs(keyRotVelocity.pitch) < 1e-5 && desiredPitchVel === 0) keyRotVelocity.pitch = 0;

        const hasActiveMove = keyMoveVelocity.lengthSq() > 0;
        const hasActiveRot = keyRotVelocity.yaw !== 0 || keyRotVelocity.pitch !== 0;

        if (hasActiveMove || hasActiveRot) {
          activeCamTransition = null;

          if (hasActiveMove) {
            const moveDelta = keyMoveVelocity.clone().multiplyScalar(dt);
            const beforeMovePos = camera.position.clone();
            camera.position.add(moveDelta);
            enforceCathedralBoundsAndSolidColumns(beforeMovePos, camera.position, orbitControls.target);
            const actualMoveDelta = camera.position.clone().sub(beforeMovePos);
            orbitControls.target.add(actualMoveDelta);
          }

          if (hasActiveRot) {
            const lookOffset = new THREE.Vector3().subVectors(orbitControls.target, camera.position);
            const dist = Math.max(0.5, lookOffset.length());
            const dir = lookOffset.normalize();
            let yaw = Math.atan2(dir.x, dir.z);
            let pitch = Math.asin(Math.max(-0.98, Math.min(0.98, dir.y)));

            yaw += keyRotVelocity.yaw * dt;
            pitch = Math.max(-1.35, Math.min(1.35, pitch + keyRotVelocity.pitch * dt));

            const cosP = Math.cos(pitch);
            const newOffset = new THREE.Vector3(
              Math.sin(yaw) * cosP * dist,
              Math.sin(pitch) * dist,
              Math.cos(yaw) * cosP * dist
            );
            orbitControls.target.copy(camera.position).add(newOffset);
          }

          if (heldCameraKeys.size > 0) {
            document
              .querySelectorAll('#btn-cam-player, #btn-cam-wide, #btn-cam-top, #btn-cam-side')
              .forEach((b) => b.classList.remove('active'));
          }
        }
      }

      if (activeCamTransition && !isAnimatingMove) {
        activeCamTransition.elapsed += dt;
        const u = Math.min(1, activeCamTransition.elapsed / activeCamTransition.duration);
        const ease = easeInOutCubic(u);
        camera.position.lerpVectors(activeCamTransition.startPos, activeCamTransition.endPos, ease);
        orbitControls.target.lerpVectors(activeCamTransition.startTarget, activeCamTransition.endTarget, ease);
        enforceCathedralBoundsAndSolidColumns(prevCamPos, camera.position, orbitControls.target);
        camera.lookAt(orbitControls.target);
        if (u >= 1) {
          activeCamTransition = null;
          flushOrbitControlsDamping();
        }
      } else if (orbitControls.enabled && !isAnimatingMove) {
        orbitControls.update();
        enforceCathedralBoundsAndSolidColumns(prevCamPos, camera.position, orbitControls.target);
        camera.lookAt(orbitControls.target);
      } else if (isAnimatingMove) {
        enforceCathedralBoundsAndSolidColumns(prevCamPos, camera.position, orbitControls.target);
        camera.lookAt(orbitControls.target);
      }

      if (impactFlashLight.intensity > 0) {
        impactFlashLight.intensity = Math.max(0, impactFlashLight.intensity - dt * 28);
      }

      for (let i = shatterDebris.length - 1; i >= 0; i--) {
        const d = shatterDebris[i];
        d.life -= dt;
        if (d.life <= 0) {
          scene.remove(d.mesh);
          shatterDebris.splice(i, 1);
          continue;
        }
        d.vel.y -= 9.8 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.mesh.position.y < BOARD_SURFACE_Y + 0.03) {
          d.mesh.position.y = BOARD_SURFACE_Y + 0.03;
          d.vel.y *= -0.35;
          d.vel.x *= 0.72;
          d.vel.z *= 0.72;
        }
        // Bounce flying stone shards off intact pieces on the board so all statues feel solid
        if (d.mesh.position.y < BOARD_SURFACE_Y + 0.48) {
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const p = boardState[r][c];
              if (p && p.mesh) {
                const rx = d.mesh.position.x - p.mesh.position.x;
                const rz = d.mesh.position.z - p.mesh.position.z;
                const rDist = Math.hypot(rx, rz);
                if (rDist < 0.165 && rDist > 0.0001) {
                  const nx = rx / rDist;
                  const nz = rz / rDist;
                  d.mesh.position.x = p.mesh.position.x + nx * 0.165;
                  d.mesh.position.z = p.mesh.position.z + nz * 0.165;
                  const vn = d.vel.x * nx + d.vel.z * nz;
                  if (vn < 0) {
                    d.vel.x -= 1.55 * vn * nx;
                    d.vel.z -= 1.55 * vn * nz;
                  }
                }
              }
            }
          }
        }
        d.mesh.rotation.x += d.rotVel.x * dt;
        d.mesh.rotation.y += d.rotVel.y * dt;
        d.mesh.rotation.z += d.rotVel.z * dt;
        if (d.life < 0.5) {
          const s = Math.max(0.01, d.life * 2);
          d.mesh.scale.setScalar((d.baseScale || 0.036) * s);
        }
      }

      // Atualizar sistemas de partículas 3D, grupo de emissores de luz e faíscas douradas coordenadas
      for (let i = magicParticleSystems.length - 1; i >= 0; i--) {
        const sys = magicParticleSystems[i];
        sys.elapsed += dt;
        if (sys.elapsed >= sys.maxLife) {
          if (sys.emitterGroup) {
            scene.remove(sys.emitterGroup);
            sys.emitterGroup.traverse((child) => {
              if (child.geometry && child.geometry !== shockwaveRingGeo && child.geometry !== sparkStreakGeo) {
                child.geometry.dispose?.();
              }
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => m.dispose?.());
                } else {
                  child.material.dispose?.();
                }
              }
            });
          }
          if (sys.points) {
            scene.remove(sys.points);
            sys.points.geometry?.dispose();
            sys.points.material?.dispose();
          }
          if (sys.shockwave) {
            scene.remove(sys.shockwave);
            sys.shockwave.material?.dispose();
          }
          magicParticleSystems.splice(i, 1);
          continue;
        }

        const ox = sys.origin.x;
        const oy = sys.origin.y;
        const oz = sys.origin.z;

        // 1. Atualizar emissor central de luz e halo no ponto da captura
        if (sys.coreLight) {
          const coreDecay = Math.max(0, 1 - sys.elapsed / 1.15);
          const pulse = 0.85 + 0.15 * Math.sin(elapsedTotal * 32);
          sys.coreLight.intensity = 9.5 * Math.pow(coreDecay, 1.6) * pulse;
        }
        if (sys.coreHalo) {
          const haloDecay = Math.max(0, 1 - sys.elapsed / 0.95);
          sys.coreHalo.material.opacity = haloDecay * 0.95;
          const haloScale = 0.38 + (1 - haloDecay) * 0.65;
          sys.coreHalo.scale.set(haloScale, haloScale, 1);
        }

        // 2. Atualizar o grupo de emissores de luz móveis (acompanhando a física dos estilhaços)
        if (sys.lightEmitters) {
          for (let eIdx = 0; eIdx < sys.lightEmitters.length; eIdx++) {
            const em = sys.lightEmitters[eIdx];
            const emFade = Math.max(0, 1 - sys.elapsed / 1.65);
            em.vel.y -= 7.8 * dt;
            em.light.position.addScaledVector(em.vel, dt);

            const worldY = oy + em.light.position.y;
            if (worldY < BOARD_SURFACE_Y + 0.04) {
              em.light.position.y = BOARD_SURFACE_Y + 0.04 - oy;
              em.vel.y = Math.abs(em.vel.y) * 0.44;
              em.vel.x *= 0.76;
              em.vel.z *= 0.76;
            }

            const flicker = 0.8 + 0.2 * Math.sin(elapsedTotal * 28 + em.phase);
            em.light.intensity = em.baseIntensity * Math.pow(emFade, 1.3) * flicker;
            if (em.sprite) {
              em.sprite.material.opacity = emFade * 0.9;
              const s = 0.16 + 0.12 * emFade * flicker;
              em.sprite.scale.set(s, s, 1);
            }
          }
        }

        // 3. Atualizar faíscas douradas 3D alongadas (sparkStreaks) com colisão no tabuleiro e nas peças
        if (sys.sparkStreaks) {
          const tmpDir = new THREE.Vector3();
          for (let sIdx = 0; sIdx < sys.sparkStreaks.length; sIdx++) {
            const st = sys.sparkStreaks[sIdx];
            if (sys.elapsed >= st.life) {
              st.mesh.visible = false;
              continue;
            }
            const stRatio = sys.elapsed / st.life;
            st.vel.y -= 8.6 * dt;
            st.vel.x *= Math.max(0, 1 - 1.1 * dt);
            st.vel.z *= Math.max(0, 1 - 1.1 * dt);
            st.mesh.position.addScaledVector(st.vel, dt);

            const worldX = ox + st.mesh.position.x;
            const worldY = oy + st.mesh.position.y;
            const worldZ = oz + st.mesh.position.z;

            if (worldY < BOARD_SURFACE_Y + 0.025) {
              st.mesh.position.y = BOARD_SURFACE_Y + 0.025 - oy;
              st.vel.y = Math.abs(st.vel.y) * 0.46;
              st.vel.x *= 0.75;
              st.vel.z *= 0.75;
            }

            // Colisão física coordenada com as peças do tabuleiro (igual aos fragmentos de pedra)
            if (worldY < BOARD_SURFACE_Y + 0.45) {
              for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                  const p = boardState[r][c];
                  if (p && p.mesh) {
                    const rx = worldX - p.mesh.position.x;
                    const rz = worldZ - p.mesh.position.z;
                    const rDist = Math.hypot(rx, rz);
                    if (rDist < 0.16 && rDist > 0.0001) {
                      const nx = rx / rDist;
                      const nz = rz / rDist;
                      const vn = st.vel.x * nx + st.vel.z * nz;
                      if (vn < 0) {
                        st.vel.x -= 1.6 * vn * nx;
                        st.vel.z -= 1.6 * vn * nz;
                      }
                    }
                  }
                }
              }
            }

            if (st.vel.lengthSq() > 1e-4) {
              tmpDir.copy(st.vel).normalize();
              st.mesh.quaternion.setFromUnitVectors(UP_AXIS, tmpDir);
            }
            const stFade = Math.pow(1 - stRatio, 1.1);
            st.mesh.material.opacity = stFade;
            st.mesh.scale.set(stFade, Math.max(0.35, stFade * 1.25), stFade);
          }
        }

        // 4. Atualizar onda de choque dourada no tabuleiro
        if (sys.shockwave) {
          const ringProgress = Math.min(1, sys.elapsed / 0.65);
          const ringScale = 0.55 + (1 - Math.pow(1 - ringProgress, 2.2)) * 3.15;
          sys.shockwave.scale.setScalar(ringScale);
          sys.shockwave.material.opacity = Math.max(0, (1 - ringProgress) * 0.88);
        }

        // 5. Atualizar nuvem de partículas (faíscas douradas, poeira mágica e brasas dos fragmentos)
        const posArr = sys.positions;
        const colArr = sys.colors;
        const baseColArr = sys.baseColors;
        const velArr = sys.velocities;
        const kinds = sys.kinds;
        const phases = sys.phases;
        const lifetimes = sys.lifetimes;

        for (let pIdx = 0; pIdx < sys.count; pIdx++) {
          const i3 = pIdx * 3;
          const lifeLimit = lifetimes[pIdx];
          const age = sys.elapsed;

          if (age >= lifeLimit) {
            colArr[i3] = 0;
            colArr[i3 + 1] = 0;
            colArr[i3 + 2] = 0;
            posArr[i3 + 1] = -999;
            continue;
          }

          const lifeRatio = age / lifeLimit;
          const kind = kinds[pIdx];

          if (kind === 1) {
            // Poeira mágica: flutuação ascendente + redemoinho suave ao redor do ponto de captura
            const dx = posArr[i3] - ox;
            const dz = posArr[i3 + 2] - oz;
            const swirlSpeed = 2.4;
            velArr[i3] += (-dz * swirlSpeed - velArr[i3] * 1.4) * dt;
            velArr[i3 + 2] += (dx * swirlSpeed - velArr[i3 + 2] * 1.4) * dt;
            velArr[i3 + 1] += (0.25 - velArr[i3 + 1] * 0.8) * dt;
          } else {
            // Faíscas douradas (0) e brasas dos estilhaços (2): gravidade e quique nas casas do tabuleiro
            velArr[i3] *= Math.max(0, 1 - 1.45 * dt);
            velArr[i3 + 2] *= Math.max(0, 1 - 1.45 * dt);
            velArr[i3 + 1] -= (kind === 2 ? 8.2 : 5.4) * dt;
          }

          posArr[i3] += velArr[i3] * dt;
          posArr[i3 + 1] += velArr[i3 + 1] * dt;
          posArr[i3 + 2] += velArr[i3 + 2] * dt;

          if (kind !== 1 && posArr[i3 + 1] < BOARD_SURFACE_Y + 0.022) {
            posArr[i3 + 1] = BOARD_SURFACE_Y + 0.022;
            velArr[i3 + 1] = Math.abs(velArr[i3 + 1]) * 0.44;
            velArr[i3] *= 0.76;
            velArr[i3 + 2] *= 0.76;
          }

          // Cintilação dourada (twinkle) e fade-out suave
          const fade = Math.pow(1 - lifeRatio, kind === 1 ? 1.35 : 0.92);
          const twinkle = 0.78 + 0.22 * Math.sin(elapsedTotal * 26 + phases[pIdx]);
          const intensity = fade * twinkle;

          colArr[i3] = baseColArr[i3] * intensity;
          colArr[i3 + 1] = baseColArr[i3 + 1] * intensity;
          colArr[i3 + 2] = baseColArr[i3 + 2] * intensity;
        }

        sys.points.geometry.attributes.position.needsUpdate = true;
        sys.points.geometry.attributes.color.needsUpdate = true;
      }

      // Advance volumetric GLSL brazier flames & active warm firelight flicker
      for (let i = 0; i < brazierFireUniforms.length; i++) {
        brazierFireUniforms[i].uTime.value = elapsedTotal;
      }
      for (let i = 0; i < brazierGlowSprites.length; i++) {
        const sp = brazierGlowSprites[i];
        const baseOp = sp.userData.baseOpacity || 0.4;
        const seed = sp.userData.seed || 0;
        sp.material.opacity =
          baseOp +
          Math.sin(elapsedTotal * 5.2 + seed) * 0.045 +
          Math.cos(elapsedTotal * 8.4 + seed * 1.3) * 0.025;
      }
      for (let i = 0; i < brazierLights.length; i++) {
        const baseInt = brazierLights[i].userData.baseIntensity || 3.2;
        brazierLights[i].intensity =
          baseInt +
          Math.sin(elapsedTotal * 5.6 + i * 1.7) * 0.28 +
          Math.cos(elapsedTotal * 9.1 + i) * 0.16;
      }

      if (
        isAnimatingMove ||
        activeMoveTweens.length > 0 ||
        shatterDebris.length > 0 ||
        magicParticleSystems.length > 0 ||
        checkmateState.active
      ) {
        renderer.shadowMap.needsUpdate = true;
      }

      if (doRender) {
        renderer.render(scene, camera);
      }
    }

    let manualStepMode = false;
    window.wizardChess.setManualStepMode = (v) => {
      manualStepMode = Boolean(v);
    };

    function animate() {
      if (!navigator.webdriver && !manualStepMode) {
        requestAnimationFrame(animate);
      }
      if (manualStepMode) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      stepScene(dt || 0.016, true);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });


    // Startup sequence (Standalone Single-Player AI Studio Applet)
    (async () => {
      await loadAllAssets();
      const params = new URLSearchParams(window.location.search);
      const urlSide = params.get('side');
      if (urlSide === 'b' || urlSide === 'black') {
        playerColor = 'b';
      }
      resetChessBoard(true, false);
      if (navigator.webdriver) {
        window.wizardChess.stepBy(0.9, 15);
      } else {
        animate();
      }
    })();
}
