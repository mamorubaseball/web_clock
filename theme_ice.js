import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

let scene, camera, renderer, controls;
let animationId;
let resizeHandler;
let uiHandlers = [];

// Constants
const CONFIG = {
    waxColor: 0xfff5e6,
    bgColor: 0x0f172a, // Ice bg
};

// State
let iceCube;
let originalPositions = [];
let simplex = new SimplexNoise();
let timerInterval = null;
let totalTime = 35 * 60;
let remainingTime = 35 * 60;
let isRunning = false;
let meltFactor = 0.0;
const timeRef = { value: 0 };
let alarmAudio = new Audio('alarm.mp3');

export function mount(container) {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.bgColor);
    scene.fog = new THREE.FogExp2(CONFIG.bgColor, 0.02);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1, 6);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // 4. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 10;

    // 5. Setup
    setupLights();
    createIceObject();
    createFloor();

    // 6. Events
    resizeHandler = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resizeHandler);

    // 7. Loop
    animate();

    return {
        startTimer: startTimer,
        stopTimer: stopTimer
    };
}

export function unmount() {
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resizeHandler);
    clearInterval(timerInterval);

    // Dispose Three.js
    if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
    }

    // Reset State
    iceCube = null;
    originalPositions = [];
    isRunning = false;
}

function setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(5, 10, 5);
    scene.add(mainLight);

    const backLight = new THREE.SpotLight(0x44aadd, 10.0);
    backLight.position.set(0, 5, -5);
    backLight.lookAt(0, 0, 0);
    scene.add(backLight);

    const bottomLight = new THREE.PointLight(0x00ffff, 1.0);
    bottomLight.position.set(0, -2, 0);
    scene.add(bottomLight);
}

function createIceObject() {
    const geometry = new THREE.BoxGeometry(2.5, 2.5, 2.5, 64, 64, 64);
    const positionAttribute = geometry.attributes.position;
    originalPositions = [];
    for (let i = 0; i < positionAttribute.count; i++) {
        originalPositions.push(
            positionAttribute.getX(i),
            positionAttribute.getY(i),
            positionAttribute.getZ(i)
        );
    }

    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 1.0,
        opacity: 1.0,
        metalness: 0.0,
        roughness: 0.15,
        ior: 1.31,
        thickness: 2.0,
        attenuationColor: 0x44aadd,
        attenuationDistance: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.0
    });

    iceCube = new THREE.Mesh(geometry, material);
    scene.add(iceCube);
}

function createFloor() {
    const planeGeo = new THREE.PlaneGeometry(20, 20);
    const planeMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.1,
        metalness: 0.8
    });
    const floor = new THREE.Mesh(planeGeo, planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.3;
    scene.add(floor);
}

function updateIceShape(timeVal, meltProgress) {
    if (!iceCube) return;

    const positions = iceCube.geometry.attributes.position;
    iceCube.position.y = - meltProgress * 0.5;

    for (let i = 0; i < positions.count; i++) {
        const ox = originalPositions[i * 3];
        const oy = originalPositions[i * 3 + 1];
        const oz = originalPositions[i * 3 + 2];

        const noiseScale = 1.5 - meltProgress * 1.0;
        const noiseAmount = 0.05 + meltProgress * 0.1;

        const nVal = simplex.noise3d(
            ox * noiseScale + timeVal * 0.2,
            oy * noiseScale + timeVal * 0.2,
            oz * noiseScale + timeVal * 0.2
        );

        const yNorm = (oy + 1.25) / 2.5;

        let nx = ox * (1.0 + meltProgress * 0.5 * (1.0 - yNorm));
        let ny = oy * (1.0 - meltProgress * 0.6);
        let nz = oz * (1.0 + meltProgress * 0.5 * (1.0 - yNorm));

        nx += nVal * noiseAmount;
        ny += nVal * noiseAmount;
        nz += nVal * noiseAmount;

        positions.setXYZ(i, nx, ny, nz);
    }

    positions.needsUpdate = true;
    iceCube.geometry.computeVertexNormals();

    if (iceCube.material) {
        iceCube.material.roughness = THREE.MathUtils.lerp(0.15, 0.02, meltProgress);
        iceCube.material.attenuationDistance = THREE.MathUtils.lerp(1.5, 5.0, meltProgress);
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);
    timeRef.value += 0.01;
    controls.update();

    if (iceCube) {
        iceCube.rotation.y = Math.sin(timeRef.value * 0.2) * 0.1;
    }

    if (isRunning && totalTime > 0) {
        meltFactor = 1.0 - (remainingTime / totalTime);
        meltFactor = Math.max(0, Math.min(1, meltFactor));
    }

    updateIceShape(timeRef.value, meltFactor);
    renderer.render(scene, camera);
}

// Exposed control functions for Main Script
function startTimer(minutes, onTick, onFinish) {
    if (alarmAudio.paused) {
        alarmAudio.play().then(() => {
            alarmAudio.pause();
            alarmAudio.currentTime = 0;
        }).catch(() => { });
    }

    clearInterval(timerInterval);
    totalTime = minutes * 60;
    remainingTime = totalTime;
    isRunning = true;
    meltFactor = 0.0;

    // Initial Tick
    if (onTick) onTick(remainingTime);

    timerInterval = setInterval(() => {
        remainingTime--;
        if (onTick) onTick(remainingTime);

        if (remainingTime <= 0) {
            finishTimer(onFinish);
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    isRunning = false;
}

function finishTimer(onFinish) {
    clearInterval(timerInterval);
    isRunning = false;
    remainingTime = 0;
    meltFactor = 1.0;

    alarmAudio.play().catch(console.error);
    if (onFinish) onFinish();
}
