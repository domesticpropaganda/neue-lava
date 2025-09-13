// threejs-gradient-shape.js
import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/OrbitControls.js?module';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Custom shader material for animated gradient

// dat.GUI controls

const params = {
    shape: 'Sphere',
    sphereSegments: 64,
    octahedronDetail: 0,
    morphSpeed: 1.0,
    bandPosition: 0.5,
    gradientScale: 1.0,
    noiseEnabled: true
};

const gui = new dat.GUI();
gui.add(params, 'shape', ['Sphere', 'Cube', 'Octahedron']).name('Shape').onChange(updateGeometry);
gui.add(params, 'sphereSegments', 8, 128, 1).name('Sphere Segments').onChange(updateGeometry);
gui.add(params, 'octahedronDetail', 0, 4, 1).name('Octahedron Detail').onChange(updateGeometry);
gui.add(params, 'noiseEnabled').name('Enable Noise');
gui.add(params, 'morphSpeed', 0.1, 5.0).name('Morph Speed');
gui.add(params, 'bandPosition', 0.0, 1.0).name('Band Position');
gui.add(params, 'gradientScale', 0.1, 3.0).name('Gradient Scale');

const vertexShader = `
    varying vec3 vPosition;
    void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;


const fragmentShader = `
        // --- Simplex noise implementation (GLSL, Ashima Arts) ---
        varying vec3 vPosition;
        uniform float time;
        uniform float morphSpeed;
        uniform float bandPosition;
        uniform float gradientScale;
        uniform float noiseEnabled;
        vec3 mod289(vec3 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }
        vec4 mod289(vec4 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }
        vec4 permute(vec4 x) {
            return mod289(((x*34.0)+1.0)*x);
        }
        float snoise(vec3 v) {
            const vec2  C = vec2(1.0/6.0, 1.0/3.0);
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 =   v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + 1.0 * C.xxx;
            vec3 x2 = x0 - i2 + 2.0 * C.xxx;
            vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
            i = mod289(i);
            vec4 p = permute( permute( permute(
                                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 1.0/7.0; // N=7
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  // mod(p,7*7)
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
            vec4 x = x_ *ns.x + ns.y;
            vec4 y = y_ *ns.x + ns.y;
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
            vec4 norm = 1.79284291400159 - 0.85373472095314 *
                vec4( dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3) );
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            vec4 m = max(0.6 - vec4( dot(x0,x0), dot(x1,x1),
                                                             dot(x2,x2), dot(x3,x3) ), 0.0);
            return 42.0 * dot( m*m*m, vec4( dot(p0,x0), dot(p1,x1),
                                                                            dot(p2,x2), dot(p3,x3) ) );
        }
    
        vec3 thermalPalette(float t) {
                // Simple blue-yellow-red palette
                return mix(
                        mix(vec3(0.0,0.0,1.0), vec3(1.0,1.0,0.0), smoothstep(0.0,0.5,t)),
                        vec3(1.0,0.0,0.0), smoothstep(0.5,1.0,t)
                );
        }
    
        void main() {
            // Edge proximity: 1.0 at edge, 0.0 at center
            // Normalize vPosition length by geometry size (sphere: 1.5, cube: 1.0, octahedron: 1.5)
            float normLen = length(vPosition) / 1.5;
            // Animate bandPosition for edge-to-center morph when noise is disabled
            float animatedBand = bandPosition;
            if (noiseEnabled < 0.5) {
                animatedBand += 0.2 * sin(time * morphSpeed);
            }
            float edgeProximity = 1.0 - smoothstep(animatedBand, animatedBand + gradientScale * 0.5, normLen);
            float noise = snoise(vec3(vPosition.x * gradientScale, vPosition.y * gradientScale, time * morphSpeed));
            float morph = noiseEnabled > 0.5 ? (noise * 0.5 + 0.5) : edgeProximity;
            float t = clamp(morph, 0.0, 1.0);
            float mask = smoothstep(1.0, 1.2, normLen * 1.5);
            vec3 color = thermalPalette(t);
            gl_FragColor = vec4(color, mask);
        }
`;

const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        time: { value: 0 },
        morphSpeed: { value: params.morphSpeed },
        bandPosition: { value: params.bandPosition },
        gradientScale: { value: params.gradientScale },
        noiseEnabled: { value: params.noiseEnabled ? 1.0 : 0.0 }
    }
});


let mesh;
function createGeometry() {
    if (params.shape === 'Sphere') {
        return new THREE.SphereGeometry(1.5, params.sphereSegments, params.sphereSegments);
    } else if (params.shape === 'Cube') {
        return new THREE.BoxGeometry(2.0, 2.0, 2.0);
    } else if (params.shape === 'Octahedron') {
        return new THREE.OctahedronGeometry(1.5, params.octahedronDetail);
    }
}

function updateGeometry() {
    if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
    }
    mesh = new THREE.Mesh(createGeometry(), material);
    scene.add(mesh);
}


updateGeometry();

// Enable camera rotation on drag
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 2;
controls.maxDistance = 20;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    material.uniforms.time.value = performance.now() * 0.001;
    material.uniforms.morphSpeed.value = params.morphSpeed;
    material.uniforms.bandPosition.value = params.bandPosition;
    material.uniforms.gradientScale.value = params.gradientScale;
    material.uniforms.noiseEnabled.value = params.noiseEnabled ? 1.0 : 0.0;
    renderer.render(scene, camera);
}
animate();
