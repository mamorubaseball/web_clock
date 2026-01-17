import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let animationId;
let resizeHandler;

// Config
const CONFIG = {
    waxColor: 0xfff5e6,
    bgColor: 0x1a0f0a,
    candleRadius: 1.2,
    candleHeight: 5.0,
};

// State
let candleMesh, wickMesh, flameMesh, flameLight;
let meltGroup;
let timerInterval = null;
let totalTime = 25 * 60;
let remainingTime = 25 * 60;
let isRunning = false;
let alarmAudio = new Audio('alarm.mp3');
const clock = new THREE.Clock();
let uiContainer = null;

// Helper to create elements (Similar to theme_clock.js)
function createElement(tag, className, parent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (parent) parent.appendChild(el);
    return el;
}

export function mount(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.bgColor);
    scene.fog = new THREE.FogExp2(CONFIG.bgColor, 0.03);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 3, 13);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;

    setupEnvironmentLights();
    createCandle();
    createFloor();

    // --- UI Generation (Dynamic) ---
    // Timer Display
    uiContainer = createElement('div', 'candle-ui-layer', container);

    const displayDiv = createElement('div', 'timer-display', uiContainer);

    const mainText = createElement('div', 'timer-main-text', displayDiv);
    const timerValueEl = createElement('span', 'time-value', mainText);
    timerValueEl.textContent = '25';
    const timerUnitEl = createElement('span', 'time-unit', mainText);
    timerUnitEl.textContent = 'min';

    const subTextEl = createElement('div', 'sub-text', displayDiv);
    subTextEl.textContent = 'Focus Session';

    // Controls
    const controlsDiv = createElement('div', 'controls', uiContainer);
    const times = [5, 10, 25, 45, 60, 90];

    times.forEach(t => {
        const btn = createElement('button', 'btn', controlsDiv);
        btn.dataset.time = t;
        btn.textContent = `${t}min`;
        if (t === 25) btn.classList.add('active');

        btn.addEventListener('click', (e) => {
            console.log('Candle button clicked:', t); // DEBUG
            // Update active state
            const allBtns = controlsDiv.querySelectorAll('.btn');
            allBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            try {
                startTimer(t, (remaining) => {
                    const m = Math.ceil(remaining / 60);
                    timerValueEl.textContent = m;

                    const mm = Math.floor(remaining / 60);
                    const ss = remaining % 60;
                    const timeStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
                    // User requested small display like webclock
                    subTextEl.textContent = timeStr;
                }, () => {
                    subTextEl.textContent = "00:00";
                });
            } catch (err) {
                console.error('Error starting candle timer:', err);
            }
        });
    });

    resizeHandler = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resizeHandler);

    animate();

    return {
        startTimer: (min) => {
            // Allow external triggers if needed, though UI is internal now
        },
        stopTimer: stopTimer,
        unmount: unmount
    };
}

export function unmount() {
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resizeHandler);
    clearInterval(timerInterval);

    if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
    }
    if (uiContainer) {
        uiContainer.remove();
    }
}


function setupEnvironmentLights() {
    const ambient = new THREE.AmbientLight(0x403020, 0.3);
    scene.add(ambient);

    const rimLight = new THREE.SpotLight(0x445588, 5);
    rimLight.position.set(-5, 5, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);
}

function createCandle() {
    meltGroup = new THREE.Group();
    scene.add(meltGroup);

    // Body
    const geometry = new THREE.CylinderGeometry(CONFIG.candleRadius, CONFIG.candleRadius, CONFIG.candleHeight, 64);
    geometry.translate(0, CONFIG.candleHeight / 2, 0);

    const material = new THREE.MeshPhysicalMaterial({
        color: CONFIG.waxColor,
        roughness: 0.3,
        metalness: 0.0,
        transmission: 0.4,
        thickness: 2.0,
        ior: 1.45,
        sheen: 0.5,
        sheenColor: 0xffffff,
        side: THREE.DoubleSide
    });

    candleMesh = new THREE.Mesh(geometry, material);
    candleMesh.castShadow = true;
    candleMesh.receiveShadow = true;
    candleMesh.position.y = -2;
    meltGroup.add(candleMesh);

    // Wick
    const wickGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
    const wickMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    wickMesh = new THREE.Mesh(wickGeo, wickMat);
    wickMesh.position.y = -2 + CONFIG.candleHeight;
    wickMesh.castShadow = true;
    meltGroup.add(wickMesh);

    // Flame Shader
    const flameGeo = new THREE.SphereGeometry(0.5, 32, 32);
    flameGeo.translate(0, 0.5, 0);

    const flameMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColorCore: { value: new THREE.Color(0xffffee) },
            uColorOuter: { value: new THREE.Color(0xffaa00) },
        },
        vertexShader: `
            uniform float uTime;
            varying vec2 vUv;
            varying float vDisp;
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
            float snoise(vec3 v) {
                const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
                vec3 i  = floor(v + dot(v, C.yyy) );
                vec3 x0 = v - i + dot(i, C.xxx) ;
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min( g.xyz, l.zxy );
                vec3 i2 = max( g.xyz, l.zxy );
                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy; 
                vec3 x3 = x0 - D.yyy;      
                i = mod289(i);
                vec4 p = permute( permute( permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                        + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                        + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                float n_ = 0.142857142857; 
                vec3  ns = n_ * D.wyz - D.xzx;
                vec4 j = p - 49.0 * floor(p * ns.z * ns.z); 
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_ );   
                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                vec4 b0 = vec4( x.xy, y.xy );
                vec4 b1 = vec4( x.zw, y.zw );
                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
                vec3 p0 = vec3(a0.xy,h.x);
                vec3 p1 = vec3(a0.zw,h.y);
                vec3 p2 = vec3(a1.xy,h.z);
                vec3 p3 = vec3(a1.zw,h.w);
                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
            }
            void main() {
                vUv = uv;
                float noise = snoise(vec3(position.x * 2.0, position.y * 2.0 + uTime * 3.0, position.z * 2.0));
                float mask = smoothstep(0.1, 1.0, uv.y);
                vec3 newPos = position;
                newPos.x += noise * 0.3 * mask;
                newPos.z += noise * 0.3 * mask;
                newPos.y += noise * 0.1 * mask;
                vDisp = noise;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uColorCore;
            uniform vec3 uColorOuter;
            varying vec2 vUv;
            varying float vDisp;
            void main() {
                float radial = 1.0 - length(vUv - 0.5) * 2.0; 
                float t = vUv.y + vDisp * 0.1;
                vec3 color = mix(uColorOuter, uColorCore, pow(1.0 - t, 2.0));
                float alpha = smoothstep(0.9, 0.4, t);
                if(t < 0.2) color += vec3(0.5); 
                float bright = 1.0 + sin(uTime * 20.0 - vUv.y * 10.0) * 0.05;
                gl_FragColor = vec4(color * bright, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.scale.set(0.6, 1.8, 0.6);
    flameMesh.position.y = wickMesh.position.y + 0.1;
    meltGroup.add(flameMesh);

    flameLight = new THREE.PointLight(0xff6600, 15, 12);
    flameLight.castShadow = true;
    flameLight.shadow.bias = -0.0001;
    flameLight.position.copy(flameMesh.position);
    meltGroup.add(flameLight);
}

function createFloor() {
    const geo = new THREE.PlaneGeometry(100, 100);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x050403,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    scene.add(floor);
}

function animate() {
    animationId = requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    controls.update();

    if (flameLight && flameMesh) {
        if (flameMesh.material.uniforms) {
            flameMesh.material.uniforms.uTime.value = time;
        }
        const flicker = Math.sin(time * 20) * 0.1 + Math.random() * 0.05;
        if (flameMesh.visible) {
            flameLight.intensity = Math.max(0, 15 + flicker * 5);
            flameLight.position.copy(flameMesh.position);
        }
    }

    if (isRunning && totalTime > 0) {
        const progress = 1 - (remainingTime / totalTime);
        candleMesh.scale.y = Math.max(0.01, 1 - progress);

        const bottomY = -2;
        const topY = bottomY + (CONFIG.candleHeight * candleMesh.scale.y);

        wickMesh.position.y = topY;
        flameMesh.position.y = topY + 0.1;

        if (progress >= 1.0) {
            finishTimer();
        }
    }
    renderer.render(scene, camera);
}

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

    // Reset visual
    candleMesh.scale.y = 1;
    const topY = -2 + CONFIG.candleHeight;
    wickMesh.position.y = topY;

    flameMesh.visible = true;
    flameMesh.scale.set(0.6, 1.8, 0.6);
    flameMesh.position.y = topY + 0.1;
    flameLight.intensity = 15;

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

    const duration = 1.0;
    const startScale = flameMesh.scale.clone();
    const startIntensity = flameLight.intensity;
    let t = 0;

    function fadeLoop() {
        t += 0.05;
        const alpha = Math.min(t / duration, 1.0);
        const s = 1.0 - alpha;
        flameMesh.scale.set(startScale.x * s, startScale.y * s, startScale.z * s);
        flameLight.intensity = startIntensity * s;

        if (alpha < 1.0) {
            requestAnimationFrame(fadeLoop);
        } else {
            flameMesh.visible = false;
            flameLight.intensity = 0;
        }
    }
    fadeLoop();

    alarmAudio.play().catch(console.error);
    if (onFinish) onFinish();
}
