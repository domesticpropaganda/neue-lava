# Thermal Mask Shader

An interactive color stream visualization using WebGL shaders and Three.js. This project creates dynamic fluid gradients that can be masked with custom images.

## Features

- Real-time thermal gradient animation
- Custom mask image upload (drag & drop or file picker)
- Interactive controls for colors, animation speed, and visual effects
- Pre-loaded mask shapes (5 different masks)
- Color theme presets
- Glow effects with customizable intensity
- Responsive design

## Dependencies

This project uses the following main dependencies:

- **Three.js** (v0.154.0) - 3D graphics library for WebGL
- **Tweakpane** (v4.0.3) - UI controls for real-time parameter adjustment
- **serve** (v14.2.1) - Development server

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/domesticpropaganda/thermal.git
   cd thermal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Development

Start the development server:
```bash
npm start
# or
npm run dev
```

The application will be available at `http://localhost:3000`

Alternative commands:
- `npm run serve` - Start server on default port
- `npm run preview` - Start server on port 8080

## Project Structure

```
thermal/
├── index.html          # Main HTML file
├── mask-gradient.js    # Main JavaScript with Three.js shaders
├── style.css          # Styles and responsive design
├── images/            # Pre-loaded mask images
│   ├── mask-1.png
│   ├── mask-2.png
│   ├── mask-3.png
│   ├── mask-4.png
│   └── mask-5.png
├── package.json       # Dependencies and scripts
├── package-lock.json  # Dependency lock file
└── .gitignore        # Git ignore file
```

## Usage

1. **Controls**: Use the controls panel in the bottom-right to adjust:
   - Visual: Upload custom masks or navigate between pre-loaded shapes
   - Animation: Control morph speed, gradient scale, and noise
   - Colors: Choose color themes or customize individual colors
   - Flows: Adjust color transition points

2. **Custom Masks**: 
   - Drag and drop image files onto the canvas
   - Or click "Upload Image" in the controls
   - Supports common image formats (PNG, JPG, etc.)
   - Maximum file size: 10MB

3. **Color Themes**: Choose from predefined themes:
   - Original: Classic thermal colors
   - Muted: Subtle color palette
   - Cool: Blue/cyan tones
   - Warm: Orange/yellow tones

## Technical Details

- Built with ES6 modules
- Uses WebGL fragment shaders for real-time effects
- Simplex noise for organic animation
- Antialiased mask edges for smooth rendering
- Responsive design with viewport-based scaling

## Browser Support

Modern browsers with WebGL support:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

MIT License - See package.json for details

## Author

Created by STUDIØE
Website: https://oygarerdal.com