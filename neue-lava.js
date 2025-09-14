import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { Pane } from 'https://cdn.skypack.dev/tweakpane@4.0.3';

// Global app state for cleanup
let appInstance = null;

// Wait for modules to be available
function initializeApp() {
    console.log('Modules loaded successfully');
    
    // Clean up any existing instance before starting new one
    if (appInstance) {
        console.log('Cleaning up existing app instance...');
        appInstance.cleanup();
        appInstance = null;
    }
    
    // Start the main application
    appInstance = startApp();
}

function startApp() {

// App state for cleanup
let animationId = null;
let eventListeners = [];
let timeouts = [];

// Preloader utility functions with improved error handling
let preloaderState = {
    isVisible: false,
    timeoutId: null,
    forceHideTimeoutId: null
};

// Enhanced timeout management
function safeSetTimeout(callback, delay) {
    const id = setTimeout(callback, delay);
    timeouts.push(id);
    return id;
}

function clearAllTimeouts() {
    timeouts.forEach(id => clearTimeout(id));
    timeouts = [];
    
    // Clear preloader timeouts
    if (preloaderState.timeoutId) {
        clearTimeout(preloaderState.timeoutId);
        preloaderState.timeoutId = null;
    }
    if (preloaderState.forceHideTimeoutId) {
        clearTimeout(preloaderState.forceHideTimeoutId);
        preloaderState.forceHideTimeoutId = null;
    }
}

// Enhanced event listener management
function safeAddEventListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
}

function removeAllEventListeners() {
    eventListeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
    });
    eventListeners = [];
}

function showPreloader(message = 'Loading...') {
    const preloader = document.getElementById('preloader');
    const preloaderText = document.querySelector('.preloader-text');
    
    if (preloader && preloaderText) {
        // Clear any existing timeouts
        if (preloaderState.timeoutId) {
            clearTimeout(preloaderState.timeoutId);
        }
        if (preloaderState.forceHideTimeoutId) {
            clearTimeout(preloaderState.forceHideTimeoutId);
        }
        
        preloaderText.textContent = message;
        preloader.classList.remove('hidden');
        preloader.style.opacity = '1';
        preloaderState.isVisible = true;
        
        // Force hide after 10 seconds as failsafe
        preloaderState.forceHideTimeoutId = safeSetTimeout(() => {
            console.warn('Preloader force-hidden after timeout');
            hidePreloader();
        }, 10000);
        
        console.log('Preloader shown:', message);
    }
}

function hidePreloader() {
    const preloader = document.getElementById('preloader');
    if (preloader && preloaderState.isVisible) {
        // Clear any existing timeouts
        if (preloaderState.timeoutId) {
            clearTimeout(preloaderState.timeoutId);
        }
        if (preloaderState.forceHideTimeoutId) {
            clearTimeout(preloaderState.forceHideTimeoutId);
        }
        
        // Immediate hide for better UX
        preloader.style.opacity = '0';
        
        // Set timeout for adding hidden class
        preloaderState.timeoutId = safeSetTimeout(() => {
            preloader.classList.add('hidden');
            preloaderState.isVisible = false;
            console.log('Preloader hidden');
        }, 300);
        
        preloaderState.isVisible = false;
    }
}

// File upload functionality
let currentMaskTexture;
let mesh, glowMesh; // Store mesh references for updating geometry
let camera; // Store camera reference
let mouse = { x: 0, y: 0 }; // Mouse position for camera rotation

function setupFileUpload() {
    const fileInput = document.getElementById('mask-upload');
    
    // Safety check for file input element
    if (!fileInput) {
        console.error('File input element not found');
        return;
    }

    // File input change
    safeAddEventListener(fileInput, 'change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Drag and drop functionality on the whole document
    safeAddEventListener(document, 'dragover', (e) => {
        e.preventDefault();
    });

    safeAddEventListener(document, 'drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    function handleFile(file) {
        // Show preloader immediately
        showPreloader('Processing image...');
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            console.error('Please select an image file');
            hidePreloader();
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            console.error('File too large (max 10MB)');
            hidePreloader();
            return;
        }

        const reader = new FileReader();
        
        // Add timeout for file reading
        const readTimeout = safeSetTimeout(() => {
            console.error('File reading timed out');
            hidePreloader();
        }, 5000);
        
        reader.onload = (e) => {
            clearTimeout(readTimeout);
            showPreloader('Loading image...');
            
            const img = new Image();
            
            // Add timeout for image loading
            const imgTimeout = safeSetTimeout(() => {
                console.error('Image loading timed out');
                hidePreloader();
            }, 5000);
            
            img.onload = () => {
                clearTimeout(imgTimeout);
                try {
                    // Calculate aspect ratio
                    const aspectRatio = img.width / img.height;
                    
                    // Create new texture from uploaded image
                    const texture = new THREE.Texture(img);
                    texture.needsUpdate = true;
                    texture.minFilter = THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    texture.generateMipmaps = false;
                    texture.wrapS = THREE.ClampToEdgeWrapping;
                    texture.wrapT = THREE.ClampToEdgeWrapping;

                    // Update the mask texture
                    updateMaskTexture(texture);
                    
                    // Update mesh aspect ratio
                    updateMeshAspectRatio(aspectRatio);
                    
                    // Update params for GUI display
                    params.currentMask = `${file.name} (${img.width}x${img.height})`;
                    
                    console.log('Mask loaded successfully:', file.name, `${img.width}x${img.height}`, `AR: ${aspectRatio.toFixed(2)}`);
                    
                    // Hide preloader after successful loading
                    hidePreloader();
                } catch (error) {
                    clearTimeout(imgTimeout);
                    console.error('Error creating texture:', error);
                    hidePreloader();
                }
            };
            
            img.onerror = () => {
                clearTimeout(imgTimeout);
                console.error('Invalid image file');
                hidePreloader();
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            clearTimeout(readTimeout);
            console.error('Failed to read file');
            hidePreloader();
        };
        
        reader.readAsDataURL(file);
    }
}

function setupMouseTracking() {
    // Track mouse position for subtle camera rotation
    safeAddEventListener(window, 'mousemove', (event) => {
        // Normalize mouse coordinates to [-1, 1] range
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });
}

function updateCameraRotation() {
    if (camera) {
        // Orbital rotation around the center point
        const orbitRadius = 2.5; // Distance from center (same as initial camera.position.z)
        const rotationIntensity = 0.3; // Adjust this to control rotation range
        
        // Calculate target angles based on mouse position
        const targetAzimuth = mouse.x * rotationIntensity; // Horizontal rotation
        const targetElevation = mouse.y * rotationIntensity * 0.5; // Vertical rotation (reduced)
        
        // Smooth interpolation for organic feel
        const lerpFactor = 0.05;
        
        // Current spherical coordinates
        const currentRadius = Math.sqrt(
            camera.position.x * camera.position.x + 
            camera.position.y * camera.position.y + 
            camera.position.z * camera.position.z
        );
        
        const currentAzimuth = Math.atan2(camera.position.x, camera.position.z);
        const currentElevation = Math.asin(camera.position.y / currentRadius);
        
        // Interpolate to target angles
        const newAzimuth = currentAzimuth + (targetAzimuth - currentAzimuth) * lerpFactor;
        const newElevation = currentElevation + (targetElevation - currentElevation) * lerpFactor;
        
        // Convert back to Cartesian coordinates
        camera.position.x = orbitRadius * Math.sin(newAzimuth) * Math.cos(newElevation);
        camera.position.y = orbitRadius * Math.sin(newElevation);
        camera.position.z = orbitRadius * Math.cos(newAzimuth) * Math.cos(newElevation);
        
        // Always look at the center
        camera.lookAt(0, 0, 0);
    }
}

function updateMaskTexture(newTexture) {
    // Store reference to current texture
    currentMaskTexture = newTexture;
    
    // Update material uniforms
    if (material && material.uniforms.maskTex) {
        material.uniforms.maskTex.value = newTexture;
    }
    if (glowMaterial && glowMaterial.uniforms.maskTex) {
        glowMaterial.uniforms.maskTex.value = newTexture;
    }
}

function updateMeshAspectRatio(aspectRatio) {
    // Get current viewport aspect ratio for responsive sizing
    const canvasContainer = document.querySelector('.canvas-container');
    if (!canvasContainer) return;
    
    const containerRect = canvasContainer.getBoundingClientRect();
    const viewportAspectRatio = containerRect.width / containerRect.height;
    
    // Calculate dimensions based on both image and viewport aspect ratios
    let maxSize = 3;
    
    // Adjust max size for mobile/narrow viewports
    if (viewportAspectRatio < 1) {
        // Portrait viewport - reduce size to prevent cropping
        maxSize = 2.5;
    } else if (viewportAspectRatio < 1.2) {
        // Narrow landscape - slightly reduce size
        maxSize = 2.8;
    }
    
    let width, height;
    
    if (aspectRatio >= 1) {
        // Landscape or square image
        width = maxSize;
        height = maxSize / aspectRatio;
        
        // Ensure image fits within viewport height on mobile
        if (height > maxSize * 0.8 && viewportAspectRatio < 1) {
            height = maxSize * 0.8;
            width = height * aspectRatio;
        }
    } else {
        // Portrait image
        height = maxSize;
        width = maxSize * aspectRatio;
        
        // Ensure image fits within viewport width on mobile
        if (width > maxSize * 0.8 && viewportAspectRatio < 1) {
            width = maxSize * 0.8;
            height = width / aspectRatio;
        }
    }
    
    // Create new geometries with calculated dimensions
    const newGeometry = new THREE.PlaneGeometry(width, height, 1, 1);
    const newGlowGeometry = new THREE.PlaneGeometry(width, height, 1, 1);
    
    // Update mesh geometries with proper cleanup
    if (mesh && mesh.geometry) {
        const oldGeometry = mesh.geometry;
        mesh.geometry = newGeometry;
        oldGeometry.dispose(); // Clean up old geometry after assignment
    }
    
    if (glowMesh && glowMesh.geometry) {
        const oldGlowGeometry = glowMesh.geometry;
        glowMesh.geometry = newGlowGeometry;
        oldGlowGeometry.dispose(); // Clean up old geometry after assignment
    }
    
    console.log(`Updated mesh aspect ratio: ${aspectRatio.toFixed(2)} (${width.toFixed(2)} x ${height.toFixed(2)})`);
}

// Helper function to get aspect ratio from image URL
function getImageAspectRatio(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const aspectRatio = img.width / img.height;
            resolve(aspectRatio);
        };
        img.onerror = () => {
            reject(new Error(`Failed to load image: ${imageUrl}`));
        };
        img.src = imageUrl;
    });
}

// Function to create meshes with proper aspect ratio
function createMeshesWithAspectRatio(aspectRatio = 1.0) {
    // Calculate dimensions
    const maxSize = 3;
    let width, height;
    
    if (aspectRatio >= 1) {
        width = maxSize;
        height = maxSize / aspectRatio;
    } else {
        height = maxSize;
        width = maxSize * aspectRatio;
    }
    
    // Create geometries
    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    const glowGeometry = new THREE.PlaneGeometry(width, height, 1, 1);
    
    // Create meshes
    mesh = new THREE.Mesh(geometry, material);
    glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.position.z = 0.01; // IN FRONT of the main mesh
    
    scene.add(glowMesh);
    scene.add(mesh);
    
    console.log(`Created meshes with aspect ratio: ${aspectRatio.toFixed(2)} (${width.toFixed(2)} x ${height.toFixed(2)})`);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Back to black for final effect

// Get canvas container dimensions - use setTimeout to ensure DOM is ready
const canvasContainer = document.querySelector('.canvas-container');

// Safety check for canvas container
if (!canvasContainer) {
    console.error('Canvas container not found');
    return null;
}

camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 2.5

const renderer = new THREE.WebGLRenderer();

// Append to the canvas container
canvasContainer.appendChild(renderer.domElement);

// Set initial size after a brief delay to ensure layout is complete
safeSetTimeout(() => {
    const containerRect = canvasContainer.getBoundingClientRect();
    camera.aspect = containerRect.width / containerRect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(containerRect.width, containerRect.height);
}, 10);

// Load default mask texture
showPreloader('Loading default mask...');

// Add timeout for default mask loading
const defaultMaskTimeout = safeSetTimeout(() => {
    console.error('Timeout loading default mask');
    hidePreloader();
}, 5000);

const maskTexture = new THREE.TextureLoader().load('images/mask-1.png', 
    // onLoad callback
    (texture) => {
        clearTimeout(defaultMaskTimeout);
        
        try {
            // Calculate aspect ratio from the loaded texture
            const image = texture.image;
            if (image && image.width && image.height) {
                const aspectRatio = image.width / image.height;
                
                // Create meshes with correct aspect ratio (only if they don't exist yet)
                if (!mesh || !glowMesh) {
                    createMeshesWithAspectRatio(aspectRatio);
                } else {
                    // Update existing meshes
                    updateMeshAspectRatio(aspectRatio);
                }
                
                console.log(`Default mask dimensions: ${image.width}x${image.height}, AR: ${aspectRatio.toFixed(2)}`);
            } else {
                // Fallback to square aspect ratio
                console.warn('Could not determine default mask dimensions, using square aspect ratio');
                if (!mesh || !glowMesh) {
                    createMeshesWithAspectRatio(1.0);
                } else {
                    updateMeshAspectRatio(1.0);
                }
            }
        } catch (error) {
            console.error('Error processing default mask aspect ratio:', error);
            // Use square as fallback
            if (!mesh || !glowMesh) {
                createMeshesWithAspectRatio(1.0);
            } else {
                updateMeshAspectRatio(1.0);
            }
        }
        
        hidePreloader();
        console.log('Default mask loaded successfully');
    },
    // onProgress callback
    undefined,
    // onError callback
    (error) => {
        clearTimeout(defaultMaskTimeout);
        console.error('Failed to load default mask:', error);
        hidePreloader();
        // Use square as fallback if default fails
        if (!mesh || !glowMesh) {
            createMeshesWithAspectRatio(1.0);
        } else {
            updateMeshAspectRatio(1.0);
        }
    }
);
maskTexture.minFilter = THREE.LinearFilter;
maskTexture.magFilter = THREE.LinearFilter;
maskTexture.generateMipmaps = false; // Disable mipmaps for better edge quality
maskTexture.wrapS = THREE.ClampToEdgeWrapping;
maskTexture.wrapT = THREE.ClampToEdgeWrapping;

// Set initial current mask texture
currentMaskTexture = maskTexture;

// Track current mask index (1-7 for mask-1.png to mask-7.png)
let currentMaskIndex = 1;

// Color themes based on the provided images
const colorThemes = {
    'Original': {
        colorBlue: [0, 0, 105],
        colorCyan: [0, 60, 255],
        colorYellow: [0, 255, 255],
        colorOrange: [255, 225, 0],
        colorRed: [245, 60, 35]
    },
      'Muted': {
        colorBlue: [16, 17, 30],
        colorCyan: [61, 73, 110],
        colorYellow: [77, 223, 235],
        colorOrange: [255, 225, 0],
        colorRed: [245, 60, 35]
    },
    'Cool': {
        colorBlue: [25, 25, 25],
        colorCyan: [71, 71, 73],
        colorYellow: [215, 240, 187],
        colorOrange: [0, 180, 255],
        colorRed: [35, 245, 220]
    },
    'Warm': {
        colorBlue: [30, 17, 2],
        colorCyan: [255, 255, 255],
        colorYellow: [217, 230, 173],
        colorOrange: [255, 225, 0],
        colorRed: [245, 60, 35]
    }
  
};

// Function to apply color theme
function applyColorTheme(themeName) {
    const theme = colorThemes[themeName];
    if (!theme) return;
    
    // Update params - Tweakpane expects {r, g, b} format for colors
    params.colorBlue = {r: theme.colorBlue[0], g: theme.colorBlue[1], b: theme.colorBlue[2]};
    params.colorCyan = {r: theme.colorCyan[0], g: theme.colorCyan[1], b: theme.colorCyan[2]};
    params.colorYellow = {r: theme.colorYellow[0], g: theme.colorYellow[1], b: theme.colorYellow[2]};
    params.colorOrange = {r: theme.colorOrange[0], g: theme.colorOrange[1], b: theme.colorOrange[2]};
    params.colorRed = {r: theme.colorRed[0], g: theme.colorRed[1], b: theme.colorRed[2]};
    params.colorBlue2 = {r: theme.colorBlue[0], g: theme.colorBlue[1], b: theme.colorBlue[2]}; // Keep colorBlue2 synced with colorBlue
    
    // Update GUI controllers to reflect the new values
    if (window.guiControllers) {
        window.guiControllers.colorBlue.refresh();
        window.guiControllers.colorCyan.refresh();
        window.guiControllers.colorYellow.refresh();
        window.guiControllers.colorOrange.refresh();
        window.guiControllers.colorRed.refresh();
    }
}

// Function to load mask by index
function loadMaskByIndex(index) {
    // Show preloader
    showPreloader(`Loading mask ${index}...`);
    
    const maskPath = `images/mask-${index}.png`;
    const loader = new THREE.TextureLoader();
    
    // Add timeout for mask loading
    const loadTimeout = safeSetTimeout(() => {
        console.error(`Timeout loading mask-${index}.png`);
        hidePreloader();
    }, 5000);
    
    loader.load(maskPath, (texture) => {
        clearTimeout(loadTimeout);
        try {
            // Set texture properties
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            
            // Calculate aspect ratio from the loaded texture
            const image = texture.image;
            if (image && image.width && image.height) {
                const aspectRatio = image.width / image.height;
                
                // Update mesh aspect ratio with the correct ratio
                updateMeshAspectRatio(aspectRatio);
                
                console.log(`Mask ${index} dimensions: ${image.width}x${image.height}, AR: ${aspectRatio.toFixed(2)}`);
            } else {
                // Fallback to square aspect ratio if image dimensions unavailable
                console.warn(`Could not determine dimensions for mask ${index}, using square aspect ratio`);
                updateMeshAspectRatio(1.0);
            }
            
            // Update the mask texture
            updateMaskTexture(texture);
            
            // Update current mask index
            currentMaskIndex = index;
            
            // Update params for GUI display
            params.currentMask = `mask-${index}.png`;
            
            console.log(`Loaded mask-${index}.png`);
            
            // Hide preloader after successful loading
            hidePreloader();
        } catch (error) {
            clearTimeout(loadTimeout);
            console.error(`Error processing mask-${index}.png:`, error);
            hidePreloader();
        }
    }, 
    // Progress callback (optional)
    (progress) => {
        // Could show progress percentage here if needed
        if (progress.total > 0) {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            console.log(`Loading mask-${index}.png: ${percentage}%`);
        }
    }, 
    // Error callback
    (error) => {
        clearTimeout(loadTimeout);
        console.error(`Failed to load mask-${index}.png:`, error);
        hidePreloader();
    });
}

const params = {
    redStart: 0.0,
    redEnd: 0.95,
    yellowStart: 0.25,
    yellowEnd: 0.5,
    greenStart: 0.5,
    greenEnd: 0.75,
    blueStart: 0.05,
    blueEnd: 1.0,
    glowIntensity: 1.0,
    glowSpread: 0.2,
    glowFalloff: 0.5,
    glowBlendMode: 'Additive',
    morphSpeed: 0.8,
    bandPosition: 0.5,
    gradientScale: 1.0,
    colorBlue: {r: 0, g: 0, b: 105},
    colorBlue2: {r: 0, g: 0, b: 105},
    colorCyan: {r: 0, g: 60, b: 255},
    colorYellow: {r: 0, g: 255, b: 255},
    colorOrange: {r: 255, g: 225, b: 0},
    colorRed: {r: 245, g: 60, b: 35},
    cyanTransition: 0.42,
    yellowTransition: 0.81,
    orangeTransition: 0.85,
    blueEnd2: 1.0,
    noiseStrength: 0.1,
    glowNoise: 0.3,
    gradientSpeed: 0.05,
    noiseType: 'Simplex',
    // Color theme selection
    colorTheme: 'Original',
    // Mask upload parameters
    currentMask: 'mask-1.png',
    uploadMask: function() {
        document.getElementById('mask-upload').click();
    },
    // Mask navigation parameters
    previousMask: function() {
        const newIndex = currentMaskIndex === 1 ? 7 : currentMaskIndex - 1;
        loadMaskByIndex(newIndex);
    },
    nextMask: function() {
        const newIndex = currentMaskIndex === 7 ? 1 : currentMaskIndex + 1;
        loadMaskByIndex(newIndex);
    }
};

// Move GUI creation after material initialization
// Check if Tweakpane is loaded
if (typeof Pane === 'undefined') {
    console.error('Tweakpane Pane is not loaded. Please check the import.');
    return;
}

const pane = new Pane({
    title: 'Playground',
    expanded: true,
});

// Create tabs using folders instead of tab pages
const visualFolder = pane.addFolder({
    title: 'Change the visual',
    expanded: true,
});

const colorsFolder = pane.addFolder({
    title: 'Pick colors',
    expanded: true,
});

const flowsFolder = pane.addFolder({
    title: 'Position colors',
    expanded: false,
});
const animationFolder = pane.addFolder({
    title: 'Change movement',
    expanded: false,
});
// Visual folder (mask controls)

visualFolder.addBinding(params, 'currentMask', {
    label: 'Current',
    readonly: true,
});
const navButton = visualFolder.addButton({
    title: '← Prev | Next →',
});

// Add click position detection for left/right navigation
navButton.element.addEventListener('click', (event) => {
    const buttonElement = event.currentTarget.querySelector('.tp-btnv_b');
    const rect = buttonElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const buttonWidth = rect.width;
    const clickPosition = clickX / buttonWidth;
    
    // Left half = Previous, Right half = Next
    let newIndex;
    if (clickPosition < 0.5) {
        // Previous (left half)
        newIndex = currentMaskIndex === 1 ? 7 : currentMaskIndex - 1;
    } else {
        // Next (right half)
        newIndex = currentMaskIndex === 7 ? 1 : currentMaskIndex + 1;
    }
    
    loadMaskByIndex(newIndex);
});

const uploadButton = visualFolder.addButton({
    title: 'Upload',
});

// Add tooltip to upload button
uploadButton.element.setAttribute('data-tooltip', 'Black&white images with solid black background work best.(JPG, PNG, max 10MB)');
uploadButton.element.classList.add('has-tooltip');

uploadButton.on('click', () => {
    document.getElementById('mask-upload').click();
});

// Export function
function exportImage() {
    showPreloader('Preparing export...');
    
    try {
        // Store current renderer size
        const currentSize = renderer.getSize(new THREE.Vector2());
        
        // Create temporary renderer for export at 1280x1280
        const exportRenderer = new THREE.WebGLRenderer({ 
            preserveDrawingBuffer: true,
            antialias: true,
            alpha: false
        });
        exportRenderer.setSize(1280, 1280);
        exportRenderer.setClearColor(0x000000, 1); // Black background
        
        // Create temporary camera with correct aspect ratio (1:1 for square export)
        const exportCamera = camera.clone();
        exportCamera.aspect = 1.0; // Square aspect ratio
        exportCamera.updateProjectionMatrix();
        
        // Render the scene
        exportRenderer.render(scene, exportCamera);
        
        // Get the canvas data
        const canvas = exportRenderer.domElement;
        
        // Create a new canvas for compositing with branding
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = 1280;
        compositeCanvas.height = 1280;
        const ctx = compositeCanvas.getContext('2d');
        
        // Draw the 3D render
        ctx.drawImage(canvas, 0, 0);
        
        // Add branding
        addBranding(ctx, 1280, 1280);
        
        // Convert to blob and download
        compositeCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `neue-lava-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Cleanup
            exportRenderer.dispose();
            hidePreloader();
            
            console.log('Image exported successfully');
        }, 'image/png');
        
    } catch (error) {
        console.error('Export failed:', error);
        hidePreloader();
    }
}

// Function to add branding to the exported image
function addBranding(ctx, width, height) {
    const padding = 40;
    const fontSize = Math.floor(width * 0.018); // Responsive font size
    const smallFontSize = Math.floor(fontSize * 0.7);
    
    // Main branding - top center
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${fontSize}px 'Space Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('NEUE—LAVA™', width / 2, padding + fontSize);
    
    // Subtitle - top center
    ctx.font = `${smallFontSize}px 'Space Mono', monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('BY STUDIØE', width / 2, padding + fontSize + smallFontSize + 5);
    
    // Color swatch - bottom center (above timestamp and copyright)
    const swatchSize = Math.floor(width * 0.025);
    const swatchPadding = Math.floor(width * 0.008);
    const totalSwatchWidth = (5 * swatchSize) + (4 * swatchPadding);
    const swatchStartX = (width - totalSwatchWidth) / 2;
    const swatchY = height - padding - smallFontSize - 50; // Positioned above timestamp
    
    // Get current color palette
    const colors = [
        params.colorBlue,
        params.colorCyan, 
        params.colorYellow,
        params.colorOrange,
        params.colorRed
    ];
    
    // Draw color swatch
    colors.forEach((color, index) => {
        const x = swatchStartX + (index * (swatchSize + swatchPadding));
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(x, swatchY, swatchSize, swatchSize);
        
        // Add subtle border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, swatchY, swatchSize, swatchSize);
    });
    

    // Copyright - bottom center
    ctx.font = `${smallFontSize}px 'Space Mono', monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('©2025 OYGARERDAL.COM', width / 2, height - padding);
}


// Colors folder
colorsFolder.addBinding(params, 'colorTheme', {
    label: 'Themes',
    options: Object.keys(colorThemes).reduce((acc, key) => {
        acc[key] = key;
        return acc;
    }, {})
}).on('change', (ev) => {
    applyColorTheme(ev.value);
});

// Store controller references for updating
window.guiControllers = {};
window.guiControllers.colorBlue = colorsFolder.addBinding(params, 'colorBlue', {
    view: 'color',
    alpha: false,
    expanded: false,
    label: 'Color 1'
}).on('change', () => {
    // Update colorBlue2 to match colorBlue when it changes
    params.colorBlue2 = {r: params.colorBlue.r, g: params.colorBlue.g, b: params.colorBlue.b};
});

window.guiControllers.colorCyan = colorsFolder.addBinding(params, 'colorCyan', {
    view: 'color',
    alpha: false,
    expanded: false,
    label: 'Color 2'
});

window.guiControllers.colorYellow = colorsFolder.addBinding(params, 'colorYellow', {
    view: 'color',
    alpha: false,
    expanded: false,
    label: 'Color 3'
});

window.guiControllers.colorOrange = colorsFolder.addBinding(params, 'colorOrange', {
    view: 'color',
    alpha: false,
    expanded: false,
    label: 'Color 4'
});

window.guiControllers.colorRed = colorsFolder.addBinding(params, 'colorRed', {
    view: 'color',
    alpha: false,
    expanded: false,
    label: 'Color 5'
});

// Store flow controller references
window.flowControllers = {};

// Flows folder
window.flowControllers.blueStart = flowsFolder.addBinding(params, 'blueStart', {
    label: 'Color 1',
    min: 0.0,
    max: 1.0,
    step: 0.01,
});

window.flowControllers.cyanTransition = flowsFolder.addBinding(params, 'cyanTransition', {
    label: 'Color 1→2',
    min: 0.0,
    max: 1.0,
    step: 0.01,
});

window.flowControllers.yellowTransition = flowsFolder.addBinding(params, 'yellowTransition', {
    label: 'Color 2→3',
    min: 0.0,
    max: 1.0,
    step: 0.01,
});

window.flowControllers.orangeTransition = flowsFolder.addBinding(params, 'orangeTransition', {
    label: 'Color 3→4',
    min: 0.0,
    max: 1.0,
    step: 0.01,
});

window.flowControllers.redEnd = flowsFolder.addBinding(params, 'redEnd', {
    label: 'Color 4→5',
    min: 0.0,
    max: 0.9,
    step: 0.01,
});

// Function to update flow constraints
function updateFlowConstraints() {
    const controllers = window.flowControllers;
    const minGap = 0.01; // Minimum gap between values
    
    // Update min values based on previous slider
    controllers.cyanTransition.min = params.blueStart + minGap;
    controllers.yellowTransition.min = params.cyanTransition + minGap;
    controllers.orangeTransition.min = params.yellowTransition + minGap;
    controllers.redEnd.min = params.orangeTransition + minGap;
    
    // Update max values based on next slider
    controllers.blueStart.max = Math.max(0, params.cyanTransition - minGap);
    controllers.cyanTransition.max = Math.max(params.blueStart + minGap, params.yellowTransition - minGap);
    controllers.yellowTransition.max = Math.max(params.cyanTransition + minGap, params.orangeTransition - minGap);
    controllers.orangeTransition.max = Math.min(Math.max(params.yellowTransition + minGap, params.redEnd - minGap), 0.9);
    
    // Clamp values to ensure they stay within the progression
    if (params.blueStart >= params.cyanTransition) {
        params.blueStart = Math.max(0, params.cyanTransition - minGap);
    }
    if (params.cyanTransition >= params.yellowTransition) {
        params.cyanTransition = Math.max(params.blueStart + minGap, params.yellowTransition - minGap);
    }
    if (params.yellowTransition >= params.orangeTransition) {
        params.yellowTransition = Math.max(params.cyanTransition + minGap, params.orangeTransition - minGap);
    }
    if (params.orangeTransition >= params.redEnd) {
        params.orangeTransition = Math.max(params.yellowTransition + minGap, Math.min(params.redEnd - minGap, 0.9));
    }
    
    // Refresh all controllers to show updated constraints and values
    Object.values(controllers).forEach(controller => controller.refresh());
}

// Add event listeners to update constraints when values change
window.flowControllers.blueStart.on('change', updateFlowConstraints);
window.flowControllers.cyanTransition.on('change', updateFlowConstraints);
window.flowControllers.yellowTransition.on('change', updateFlowConstraints);
window.flowControllers.orangeTransition.on('change', updateFlowConstraints);
window.flowControllers.redEnd.on('change', updateFlowConstraints);

// Initialize constraints
updateFlowConstraints();


// Animation folder
animationFolder.addBinding(params, 'morphSpeed', {
    label: 'Speed',
    min: 0.1,
    max: 5.0,
});

animationFolder.addBinding(params, 'gradientScale', {
    label: 'Gradients',
    min: 0.1,
    max: 3.0,
});

animationFolder.addBinding(params, 'noiseStrength', {
    label: 'Noise',
    min: 0.0,
    max: 0.5,
    step: 0.01,
});

animationFolder.addBinding(params, 'noiseType', {
    label: 'Density',
    options: {
        'Thick': 'Simplex',
        'Thin': 'fBm'
    }
});

// Capture an image folder (export controls)
const exportFolder = pane.addFolder({
    title: 'Capture images',
    expanded: false,
});

exportFolder.addButton({
    title: 'Download a snapshot',
}).on('click', () => {
    exportImage();
});

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
    uniform float glowNoise;
    uniform float gradientSpeed;
    
    // Simplex noise function (same as main gradient)
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
        
        // Add noise to glow opacity for more organic feel - use same noise as gradient
        float glowNoiseValue = snoise(vec3(vUv * 3.0, time * 0.2)); // Same noise calculation as main gradient
        float noiseMultiplier = 1.0 + glowNoiseValue * glowNoise; // Apply glow noise strength
        glow *= noiseMultiplier;
        
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
    
    // Fractal Brownian Motion (fBm) noise
    float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        // 4 octaves for good detail without too much computation
        for(int i = 0; i < 4; i++) {
            value += amplitude * snoise(p * frequency);
            amplitude *= 0.5;  // Each octave has half the amplitude
            frequency *= 2.0;  // Each octave has double the frequency
        }
        
        return value;
    }
    
    uniform float noiseStrength;
    uniform int noiseType; // 0 = Simplex, 1 = fBm
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
        
        // Select noise type based on uniform
        float noise;
        if (noiseType == 0) {
            noise = snoise(vec3(vUv * 3.0, time * 0.2));
        } else {
            noise = fbm(vec3(vUv * 2.0, time * 0.15)); // Slightly different parameters for fBm
        }
        
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
        maskTex: { value: currentMaskTexture },
        colorBlue: { value: new THREE.Color(params.colorBlue.r/255, params.colorBlue.g/255, params.colorBlue.b/255) },
        colorCyan: { value: new THREE.Color(params.colorCyan.r/255, params.colorCyan.g/255, params.colorCyan.b/255) },
        colorYellow: { value: new THREE.Color(params.colorYellow.r/255, params.colorYellow.g/255, params.colorYellow.b/255) },
        colorOrange: { value: new THREE.Color(params.colorOrange.r/255, params.colorOrange.g/255, params.colorOrange.b/255) },
        colorRed: { value: new THREE.Color(params.colorRed.r/255, params.colorRed.g/255, params.colorRed.b/255) },
        colorBlue2: { value: new THREE.Color(params.colorBlue2.r/255, params.colorBlue2.g/255, params.colorBlue2.b/255) },
        blueStart: { value: params.blueStart },
        cyanTransition: { value: params.cyanTransition },
        yellowTransition: { value: params.yellowTransition },
        orangeTransition: { value: params.orangeTransition },
        redEnd: { value: params.redEnd },
        blueEnd2: { value: params.blueEnd2 },
    // ...existing code...
        noiseStrength: { value: params.noiseStrength },
        noiseType: { value: params.noiseType === 'Simplex' ? 0 : 1 },
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
        maskTex: { value: currentMaskTexture },
        glowIntensity: { value: params.glowIntensity },
        glowSpread: { value: params.glowSpread },
        glowFalloff: { value: params.glowFalloff },
        // Animation uniforms
        morphSpeed: { value: params.morphSpeed },
        bandPosition: { value: params.bandPosition },
        gradientScale: { value: params.gradientScale },
        noiseStrength: { value: params.noiseStrength },
        glowNoise: { value: params.glowNoise },
        gradientSpeed: { value: params.gradientSpeed },
        // Thermal gradient uniforms
        colorBlue: { value: new THREE.Color(params.colorBlue.r/255, params.colorBlue.g/255, params.colorBlue.b/255) },
        colorCyan: { value: new THREE.Color(params.colorCyan.r/255, params.colorCyan.g/255, params.colorCyan.b/255) },
        colorYellow: { value: new THREE.Color(params.colorYellow.r/255, params.colorYellow.g/255, params.colorYellow.b/255) },
        colorOrange: { value: new THREE.Color(params.colorOrange.r/255, params.colorOrange.g/255, params.colorOrange.b/255) },
        colorRed: { value: new THREE.Color(params.colorRed.r/255, params.colorRed.g/255, params.colorRed.b/255) },
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

// Meshes will be created after default mask loads to ensure correct aspect ratio

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

function animate() {
    animationId = requestAnimationFrame(animate);
    const time = performance.now() * 0.001;
    
    // Update camera rotation based on mouse position
    updateCameraRotation();
    
    // Only proceed with rendering if meshes are created
    if (!mesh || !glowMesh) {
        return;
    }
    
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
    glowMaterial.uniforms.glowNoise.value = params.glowNoise;
    glowMaterial.uniforms.gradientSpeed.value = params.gradientSpeed;
    
    // Update glow thermal colors (sync with main material)
    glowMaterial.uniforms.colorBlue.value.setRGB(params.colorBlue.r/255, params.colorBlue.g/255, params.colorBlue.b/255);
    glowMaterial.uniforms.colorCyan.value.setRGB(params.colorCyan.r/255, params.colorCyan.g/255, params.colorCyan.b/255);
    glowMaterial.uniforms.colorYellow.value.setRGB(params.colorYellow.r/255, params.colorYellow.g/255, params.colorYellow.b/255);
    glowMaterial.uniforms.colorOrange.value.setRGB(params.colorOrange.r/255, params.colorOrange.g/255, params.colorOrange.b/255);
    glowMaterial.uniforms.colorRed.value.setRGB(params.colorRed.r/255, params.colorRed.g/255, params.colorRed.b/255);
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
    material.uniforms.colorBlue.value.setRGB(params.colorBlue.r/255, params.colorBlue.g/255, params.colorBlue.b/255);
    material.uniforms.colorCyan.value.setRGB(params.colorCyan.r/255, params.colorCyan.g/255, params.colorCyan.b/255);
    material.uniforms.colorYellow.value.setRGB(params.colorYellow.r/255, params.colorYellow.g/255, params.colorYellow.b/255);
    material.uniforms.colorOrange.value.setRGB(params.colorOrange.r/255, params.colorOrange.g/255, params.colorOrange.b/255);
    material.uniforms.colorRed.value.setRGB(params.colorRed.r/255, params.colorRed.g/255, params.colorRed.b/255);
    material.uniforms.colorBlue2.value.setRGB(params.colorBlue2.r/255, params.colorBlue2.g/255, params.colorBlue2.b/255);
        material.uniforms.noiseStrength.value = params.noiseStrength;
        material.uniforms.noiseType.value = params.noiseType === 'Simplex' ? 0 : 1;
        // ...existing code...
    material.uniforms.gradientSpeed.value = params.gradientSpeed;
    renderer.render(scene, camera);
}
animate();

// Initialize file upload functionality
setupFileUpload();

// Initialize mouse tracking
setupMouseTracking();

// Handle window resize
safeAddEventListener(window, 'resize', () => {
    const canvasContainer = document.querySelector('.canvas-container');
    if (!canvasContainer) return;
    
    const containerRect = canvasContainer.getBoundingClientRect();
    
    camera.aspect = containerRect.width / containerRect.height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(containerRect.width, containerRect.height);
    
    // Recalculate mesh size for new viewport dimensions
    if (currentMaskTexture && currentMaskTexture.image) {
        const aspectRatio = currentMaskTexture.image.width / currentMaskTexture.image.height;
        updateMeshAspectRatio(aspectRatio);
    }
});

// Initial resize to ensure proper sizing
safeAddEventListener(window, 'load', () => {
    const canvasContainer = document.querySelector('.canvas-container');
    if (!canvasContainer) return;
    
    const containerRect = canvasContainer.getBoundingClientRect();
    
    camera.aspect = containerRect.width / containerRect.height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(containerRect.width, containerRect.height);
});

// Return cleanup object
return {
    cleanup: function() {
        console.log('Cleaning up app resources...');
        
        // Stop animation loop
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // Clear all timeouts
        clearAllTimeouts();
        
        // Remove all event listeners
        removeAllEventListeners();
        
        // Cleanup Three.js resources
        if (scene) {
            // Dispose of all meshes and their geometries/materials
            scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => {
                                if (material.map) material.map.dispose();
                                material.dispose();
                            });
                        } else {
                            if (child.material.map) child.material.map.dispose();
                            child.material.dispose();
                        }
                    }
                }
            });
            
            // Clear the scene
            while(scene.children.length > 0) {
                scene.remove(scene.children[0]);
            }
        }
        
        // Dispose of materials
        if (material) {
            // Dispose of material uniforms textures
            Object.values(material.uniforms).forEach(uniform => {
                if (uniform.value && uniform.value.dispose && typeof uniform.value.dispose === 'function') {
                    uniform.value.dispose();
                }
            });
            material.dispose();
        }
        
        if (glowMaterial) {
            // Dispose of glow material uniforms textures
            Object.values(glowMaterial.uniforms).forEach(uniform => {
                if (uniform.value && uniform.value.dispose && typeof uniform.value.dispose === 'function') {
                    uniform.value.dispose();
                }
            });
            glowMaterial.dispose();
        }
        
        // Dispose of textures
        if (currentMaskTexture) {
            currentMaskTexture.dispose();
        }
        
        // Dispose of renderer
        if (renderer) {
            renderer.dispose();
            renderer.forceContextLoss();
            
            // Remove canvas from DOM
            const canvas = renderer.domElement;
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }
        
        // Cleanup GUI
        if (pane) {
            pane.dispose();
        }
        
        // Reset global variables
        mesh = null;
        glowMesh = null;
        camera = null;
        currentMaskTexture = null;
        mouse = { x: 0, y: 0 };
        preloaderState = {
            isVisible: false,
            timeoutId: null,
            forceHideTimeoutId: null
        };
        
        console.log('App cleanup completed');
    }
};

} // End of startApp function

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (appInstance) {
        appInstance.cleanup();
        appInstance = null;
    }
});
