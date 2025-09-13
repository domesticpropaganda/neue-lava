import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/OrbitControls.js?module';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Back to black for final effect

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 4;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const maskTexture = new THREE.TextureLoader().load('images/cubemask.png');
maskTexture.minFilter = THREE.LinearFilter;
maskTexture.magFilter = THREE.LinearFilter;
maskTexture.generateMipmaps = false; // Disable mipmaps for better edge quality
maskTexture.wrapS = THREE.ClampToEdgeWrapping;
maskTexture.wrapT = THREE.ClampToEdgeWrapping;

const params = {
    redStart: 0.0,
    redEnd: 0.95,
    yellowStart: 0.25,
    yellowEnd: 0.5,
    greenStart: 0.5,
    greenEnd: 0.75,
    blueStart: 0.0,
    blueEnd: 1.0,
    glowIntensity: 2.0,
    glowSpread: 0.2,
    glowFalloff: 0.4,
    glowBlendMode: 'Additive',
    morphSpeed: 1.0,
    bandPosition: 0.5,
    gradientScale: 1.0,
    colorBlue: [0, 0, 255],
    colorBlue2: [0, 0, 200],
    colorCyan: [0, 255, 255],
    colorYellow: [255, 255, 0],
    colorOrange: [255, 165, 0],
    colorRed: [255, 0, 0],
    cyanTransition: 0.65,
    yellowTransition: 0.7,
    orangeTransition: 0.75,
    blueEnd2: 1.0,
    noiseStrength: 0.1,
    gradientSpeed: 0.05
};

// Move GUI creation after material initialization
const gui = new dat.GUI();
gui.add(params, 'morphSpeed', 0.1, 5.0).name('Morph Speed');
gui.add(params, 'bandPosition', 0.0, 1.0).name('Band Position');
gui.add(params, 'gradientScale', 0.1, 3.0).name('Gradient Scale');
gui.addColor(params, 'colorBlue').name('Blue');
gui.addColor(params, 'colorCyan').name('Cyan');
gui.addColor(params, 'colorYellow').name('Yellow');
gui.addColor(params, 'colorOrange').name('Orange');
gui.addColor(params, 'colorRed').name('Red');
gui.add(params, 'blueStart', 0.0, 1.0, 0.01).name('Blue Start');
gui.add(params, 'cyanTransition', 0.0, 1.0, 0.01).name('Blue→Cyan');
gui.add(params, 'yellowTransition', 0.0, 1.0, 0.01).name('Cyan→Yellow');
gui.add(params, 'orangeTransition', 0.0, 1.0, 0.01).name('Yellow→Orange');
gui.add(params, 'redEnd', 0.0, 1.0, 0.01).name('Orange→Red');
gui.add(params, 'noiseStrength', 0.0, 0.5, 0.01).name('Noise Strength');
gui.add(params, 'gradientSpeed', 0.0, 0.2, 0.001).name('Gradient Speed');
gui.add(params, 'glowIntensity', 0.0, 5.0, 0.1).name('Glow Intensity');
gui.add(params, 'glowSpread', 0.01, 0.5, 0.005).name('Glow Spread');
gui.add(params, 'glowFalloff', 0.1, 2.0, 0.1).name('Glow Falloff');
gui.add(params, 'glowBlendMode', ['Additive', 'Normal', 'Multiply', 'Screen', 'Subtractive']).name('Glow Blend Mode');

// Helper function to get blend mode constant
function getBlendMode(blendModeString) {
    switch(blendModeString) {
        case 'Additive': return THREE.AdditiveBlending;
        case 'Normal': return THREE.NormalBlending;
        case 'Multiply': return THREE.MultiplyBlending;
        case 'Screen': return THREE.ScreenBlending;
        case 'Subtractive': return THREE.SubtractiveBlending;
        default: return THREE.AdditiveBlending;
    }
}

const vertexShader = `
    varying vec3 vPosition;
    varying vec2 vUv;
    void main() {
        vPosition = position;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Simple glow vertex shader
const glowVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Thermal-colored glow fragment shader - simple blur kernel
const glowFragmentShader = `
    varying vec2 vUv;
    uniform sampler2D maskTex;
    uniform float time;
    uniform float glowIntensity;
    uniform float glowSpread;
    uniform float glowFalloff;
    uniform float morphSpeed;
    uniform float bandPosition;
    uniform float gradientScale;
    uniform float noiseStrength;
    uniform float gradientSpeed;
    
    // Thermal gradient uniforms
    uniform vec3 colorBlue;
    uniform vec3 colorCyan;
    uniform vec3 colorYellow;
    uniform vec3 colorOrange;
    uniform vec3 colorRed;
    uniform float blueStart;
    uniform float cyanTransition;
    uniform float yellowTransition;
    uniform float orangeTransition;
    uniform float blueEnd2;
    
    // Simple noise function
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    vec3 getThermalColor(float value) {
        float t = fract(value); // wrap t to [0,1)
        // Color stops and positions
        float stops[6];
        stops[0] = blueStart;
        stops[1] = cyanTransition;
        stops[2] = yellowTransition;
        stops[3] = orangeTransition;
        stops[4] = blueEnd2;
        stops[5] = 1.0;
        vec3 colors[6];
        colors[0] = colorBlue;
        colors[1] = colorCyan;
        colors[2] = colorYellow;
        colors[3] = colorOrange;
        colors[4] = colorRed;
        colors[5] = colorBlue;
        // Always interpolate between closest two stops, wrapping around
        int i = 0;
        for (int j = 0; j < 6; ++j) {
            float a = stops[j];
            float b = stops[(j+1)%6];
            // If t is between a and b (including wrap-around)
            if ((a < b && t >= a && t < b) || (a > b && (t >= a || t < b))) {
                i = j;
                break;
            }
        }
        float a = stops[i];
        float b = stops[(i+1)%6];
        float range = b > a ? b - a : (b + 1.0 - a);
        float localT = t >= a ? (t - a) / max(range, 0.0001) : (t + 1.0 - a) / max(range, 0.0001);
        return mix(colors[i], colors[(i+1)%6], clamp(localT, 0.0, 1.0));
    }
    
    void main() {
        // Sample the original mask
        float originalMask = texture2D(maskTex, vUv).r;
        
        // Instead of hard cutoff, use smooth transition to eliminate gap
        float maskFade = 1.0 - smoothstep(0.05, 0.12, originalMask);
        
        // Early exit if we're deep inside the mask
        if(maskFade < 0.01) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        
        // SIMPLE BUT EFFECTIVE: Just blur the mask directly
        float blurredMask = 0.0;
        vec3 blurredColor = vec3(0.0);
        float totalWeight = 0.0;
        
        // Simple box blur with large kernel
        int blurSize = 16; // Large blur kernel
        float step = glowSpread / float(blurSize);
        
        for(int x = -8; x <= 8; x++) {
            for(int y = -8; y <= 8; y++) {
                vec2 offset = vec2(float(x), float(y)) * step;
                vec2 samplePos = vUv + offset;
                
                float maskSample = texture2D(maskTex, samplePos).r;
                
                // Simple distance weight
                float distance = length(offset);
                float weight = 1.0 / (1.0 + distance * distance / (glowSpread * glowSpread));
                
                blurredMask += maskSample * weight;
                
                if(maskSample > 0.08) {
                    // Calculate thermal color - sync with main gradient animation
                    float animatedValue = maskSample;
                    
                    // Match main gradient's band animation exactly
                    float bandAnim = mod(bandPosition + 1.0 - fract(time * morphSpeed * 0.2), 1.0);
                    float animatedBand = fract(time * morphSpeed * 0.2);
                    
                    float verticalOffset = mod(time * gradientSpeed, 1.0);
                    float gradientY = fract((samplePos.y - verticalOffset) * gradientScale);
                    
                    // Use same noise calculation as main gradient (simplified version)
                    float noise = fract(sin(dot(samplePos + time * 0.2, vec2(12.9898,78.233))) * 43758.5453123) * noiseStrength;
                    float t = mod(animatedValue + animatedBand + gradientY + bandPosition + noise, 1.0);
                    
                    vec3 thermalColor = getThermalColor(t);
                    blurredColor += thermalColor * weight;
                }
                
                totalWeight += weight;
            }
        }
        
        // Normalize
        if(totalWeight > 0.0) {
            blurredMask /= totalWeight;
            blurredColor /= totalWeight;
        }
        
        // Create final glow
        float glow = blurredMask;
        
        // Apply falloff
        glow = pow(glow, glowFalloff);
        
        // Smooth
        glow = smoothstep(0.0, 1.0, glow);
        
        // Add pulsing
        float pulse = 1.0 + 0.2 * sin(time * 2.0);
        glow *= pulse;
        
        // Apply intensity and fade factor to eliminate gap
        glow *= glowIntensity * maskFade;
        
        gl_FragColor = vec4(blurredColor * 1.3, glow);
    }
`;

const fragmentShader = `
    varying vec3 vPosition;
    varying vec2 vUv;
    uniform float time;
    uniform float morphSpeed;
    uniform float bandPosition;
    uniform float gradientScale;
    // noiseEnabled removed
    uniform sampler2D maskTex;
    uniform float gradientSpeed;
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
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
    uniform float noiseStrength;
    uniform vec3 colorBlue;
    uniform vec3 colorCyan;
    uniform vec3 colorYellow;
    uniform vec3 colorOrange;
    uniform vec3 colorRed;
    uniform vec3 colorBlue2;
    uniform float blueStart;
    uniform float cyanTransition;
    uniform float yellowTransition;
    uniform float orangeTransition;
    uniform float redEnd;
    uniform float blueEnd2;
    vec3 thermalPalette(float t) {
        t = fract(t); // wrap t to [0,1)
        // Color stops and positions
        float stops[6];
        stops[0] = blueStart;
        stops[1] = cyanTransition;
        stops[2] = yellowTransition;
        stops[3] = orangeTransition;
        stops[4] = redEnd;
        stops[5] = blueEnd2;
        vec3 colors[6];
        colors[0] = colorBlue;
        colors[1] = colorCyan;
        colors[2] = colorYellow;
        colors[3] = colorOrange;
        colors[4] = colorRed;
        colors[5] = colorBlue2;
        // Always interpolate between closest two stops, wrapping around
        int i = 0;
        for (int j = 0; j < 6; ++j) {
            float a = stops[j];
            float b = stops[(j+1)%6];
            // If t is between a and b (including wrap-around)
            if ((a < b && t >= a && t < b) || (a > b && (t >= a || t < b))) {
                i = j;
                break;
            }
        }
        float a = stops[i];
        float b = stops[(i+1)%6];
        float range = b > a ? b - a : (b + 1.0 - a);
        float localT = t >= a ? (t - a) / max(range, 0.0001) : (t + 1.0 - a) / max(range, 0.0001);
        return mix(colors[i], colors[(i+1)%6], clamp(localT, 0.0, 1.0));
    }
    void main() {
        // Sample the mask with antialiasing
        float maskValue = texture2D(maskTex, vUv).r;
        
        // Calculate derivatives for antialiasing
        vec2 uvDdx = dFdx(vUv);
        vec2 uvDdy = dFdy(vUv);
        float maskDdx = dFdx(maskValue);
        float maskDdy = dFdy(maskValue);
        
        // Calculate the gradient magnitude to detect edges
        float gradientMagnitude = length(vec2(maskDdx, maskDdy));
        
        // Use fwidth for automatic antialiasing width
        float antialiasWidth = fwidth(maskValue) * 2.0;
        
        // Smooth the mask edge with proper antialiasing - start earlier to overlap with glow
        float mask = smoothstep(0.08 - antialiasWidth, 0.08 + antialiasWidth, maskValue);
        
        float bandAnim = mod(bandPosition + 1.0 - fract(time * morphSpeed * 0.2), 1.0);
        float animatedBand = fract(time * morphSpeed * 0.2);
        
        // Animate gradient fill downward by offsetting only the gradient calculation
        float verticalOffset = mod(time * gradientSpeed, 1.0); // downward movement, speed controlled by uniform
        float gradientY = fract((vUv.y - verticalOffset) * gradientScale);
        
        float noise = snoise(vec3(vUv * 3.0, time * 0.2));
        float t = mod(maskValue + animatedBand + gradientY + bandPosition + noise * noiseStrength, 1.0);
        t = smoothstep(0.0, 1.0, t);
        
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
        maskTex: { value: maskTexture },
        colorBlue: { value: new THREE.Color(params.colorBlue[0]/255, params.colorBlue[1]/255, params.colorBlue[2]/255) },
        colorCyan: { value: new THREE.Color(params.colorCyan[0]/255, params.colorCyan[1]/255, params.colorCyan[2]/255) },
        colorYellow: { value: new THREE.Color(params.colorYellow[0]/255, params.colorYellow[1]/255, params.colorYellow[2]/255) },
        colorOrange: { value: new THREE.Color(params.colorOrange[0]/255, params.colorOrange[1]/255, params.colorOrange[2]/255) },
        colorRed: { value: new THREE.Color(params.colorRed[0]/255, params.colorRed[1]/255, params.colorRed[2]/255) },
        colorBlue2: { value: new THREE.Color(params.colorBlue2[0]/255, params.colorBlue2[1]/255, params.colorBlue2[2]/255) },
        blueStart: { value: params.blueStart },
        cyanTransition: { value: params.cyanTransition },
        yellowTransition: { value: params.yellowTransition },
        orangeTransition: { value: params.orangeTransition },
        redEnd: { value: params.redEnd },
        blueEnd2: { value: params.blueEnd2 },
    // ...existing code...
        noiseStrength: { value: params.noiseStrength },
        gradientSpeed: { value: params.gradientSpeed }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

// Create glow material
const glowMaterial = new THREE.ShaderMaterial({
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    uniforms: {
        time: { value: 0 },
        maskTex: { value: maskTexture },
        glowIntensity: { value: params.glowIntensity },
        glowSpread: { value: params.glowSpread },
        glowFalloff: { value: params.glowFalloff },
        // Animation uniforms
        morphSpeed: { value: params.morphSpeed },
        bandPosition: { value: params.bandPosition },
        gradientScale: { value: params.gradientScale },
        noiseStrength: { value: params.noiseStrength },
        gradientSpeed: { value: params.gradientSpeed },
        // Thermal gradient uniforms
        colorBlue: { value: new THREE.Color(params.colorBlue[0]/255, params.colorBlue[1]/255, params.colorBlue[2]/255) },
        colorCyan: { value: new THREE.Color(params.colorCyan[0]/255, params.colorCyan[1]/255, params.colorCyan[2]/255) },
        colorYellow: { value: new THREE.Color(params.colorYellow[0]/255, params.colorYellow[1]/255, params.colorYellow[2]/255) },
        colorOrange: { value: new THREE.Color(params.colorOrange[0]/255, params.colorOrange[1]/255, params.colorOrange[2]/255) },
        colorRed: { value: new THREE.Color(params.colorRed[0]/255, params.colorRed[1]/255, params.colorRed[2]/255) },
        blueStart: { value: params.blueStart },
        cyanTransition: { value: params.cyanTransition },
        yellowTransition: { value: params.yellowTransition },
        orangeTransition: { value: params.orangeTransition },
        blueEnd2: { value: params.blueEnd2 }
    },
    transparent: true,
    depthWrite: false,
    blending: getBlendMode(params.glowBlendMode) // Use dynamic blend mode
});

const geometry = new THREE.PlaneGeometry(3, 3, 1, 1);
const mesh = new THREE.Mesh(geometry, material);

// Create glow mesh (same size, in front)
const glowGeometry = new THREE.PlaneGeometry(3, 3, 1, 1);
const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
glowMesh.position.z = 0.01; // IN FRONT of the main mesh

scene.add(glowMesh); // Add glow behind first
scene.add(mesh); // Add main mesh on top

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 2;
controls.maxDistance = 20;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * 0.001;
    
    material.uniforms.time.value = time;
    material.uniforms.morphSpeed.value = params.morphSpeed;
    material.uniforms.bandPosition.value = params.bandPosition;
    material.uniforms.gradientScale.value = params.gradientScale;
    
    // Update glow
    glowMaterial.uniforms.time.value = time;
    glowMaterial.uniforms.glowIntensity.value = params.glowIntensity;
    glowMaterial.uniforms.glowSpread.value = params.glowSpread;
    glowMaterial.uniforms.glowFalloff.value = params.glowFalloff;
    glowMaterial.blending = getBlendMode(params.glowBlendMode);
    
    // Update glow animation parameters (sync with main shader)
    glowMaterial.uniforms.morphSpeed.value = params.morphSpeed;
    glowMaterial.uniforms.bandPosition.value = params.bandPosition;
    glowMaterial.uniforms.gradientScale.value = params.gradientScale;
    glowMaterial.uniforms.noiseStrength.value = params.noiseStrength;
    glowMaterial.uniforms.gradientSpeed.value = params.gradientSpeed;
    
    // Update glow thermal colors (sync with main material)
    glowMaterial.uniforms.colorBlue.value.setRGB(params.colorBlue[0]/255, params.colorBlue[1]/255, params.colorBlue[2]/255);
    glowMaterial.uniforms.colorCyan.value.setRGB(params.colorCyan[0]/255, params.colorCyan[1]/255, params.colorCyan[2]/255);
    glowMaterial.uniforms.colorYellow.value.setRGB(params.colorYellow[0]/255, params.colorYellow[1]/255, params.colorYellow[2]/255);
    glowMaterial.uniforms.colorOrange.value.setRGB(params.colorOrange[0]/255, params.colorOrange[1]/255, params.colorOrange[2]/255);
    glowMaterial.uniforms.colorRed.value.setRGB(params.colorRed[0]/255, params.colorRed[1]/255, params.colorRed[2]/255);
    glowMaterial.uniforms.blueStart.value = params.blueStart;
    glowMaterial.uniforms.cyanTransition.value = params.cyanTransition;
    glowMaterial.uniforms.yellowTransition.value = params.yellowTransition;
    glowMaterial.uniforms.orangeTransition.value = params.orangeTransition;
    glowMaterial.uniforms.blueEnd2.value = params.blueEnd2;
    
    // Sort and validate stops before updating uniforms
    let stops = [
        params.blueStart,
        params.cyanTransition,
        params.yellowTransition,
        params.orangeTransition,
        params.redEnd,
        params.blueEnd2
    ];
    // Ensure strictly increasing and no zero-width segments
    for (let i = 1; i < stops.length; ++i) {
        if (stops[i] <= stops[i-1]) {
            stops[i] = stops[i-1] + 0.0001;
        }
    }
    material.uniforms.blueStart.value = stops[0];
    material.uniforms.cyanTransition.value = stops[1];
    material.uniforms.yellowTransition.value = stops[2];
    material.uniforms.orangeTransition.value = stops[3];
    material.uniforms.redEnd.value = stops[4];
    material.uniforms.blueEnd2.value = stops[5];
    material.uniforms.colorBlue.value.setRGB(params.colorBlue[0]/255, params.colorBlue[1]/255, params.colorBlue[2]/255);
    material.uniforms.colorCyan.value.setRGB(params.colorCyan[0]/255, params.colorCyan[1]/255, params.colorCyan[2]/255);
    material.uniforms.colorYellow.value.setRGB(params.colorYellow[0]/255, params.colorYellow[1]/255, params.colorYellow[2]/255);
    material.uniforms.colorOrange.value.setRGB(params.colorOrange[0]/255, params.colorOrange[1]/255, params.colorOrange[2]/255);
    material.uniforms.colorRed.value.setRGB(params.colorRed[0]/255, params.colorRed[1]/255, params.colorRed[2]/255);
    material.uniforms.colorBlue2.value.setRGB(params.colorBlue2[0]/255, params.colorBlue2[1]/255, params.colorBlue2[2]/255);
        material.uniforms.noiseStrength.value = params.noiseStrength;
        // ...existing code...
    material.uniforms.gradientSpeed.value = params.gradientSpeed;
    renderer.render(scene, camera);
}
animate();
