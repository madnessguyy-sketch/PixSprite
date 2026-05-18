const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const pCtx = previewCanvas.getContext('2d');
const onionCanvas = document.getElementById('onionCanvas');
const oCtx = onionCanvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');

// UI Controls
const widthInput = document.getElementById('canvasWidth');
const heightInput = document.getElementById('canvasHeight');
const resizeBtn = document.getElementById('resizeBtn');
const saveBtn = document.getElementById('saveBtn');
const exportFormatSelect = document.getElementById('exportFormat');
const statusCoords = document.getElementById('status-coords');
const statusDim = document.getElementById('status-dim');
const brushSizeInput = document.getElementById('brushSize');
const brushSizeDisplay = document.getElementById('brushSizeDisplay');

// Animation Controls
const playBtn = document.getElementById('playBtn');
const addFrameBtn = document.getElementById('addFrameBtn');
const deleteFrameBtn = document.getElementById('deleteFrameBtn');
const onionBtn = document.getElementById('onionBtn');
const frameStrip = document.getElementById('frameStrip');

// Scaling Configuration
const PIXEL_SCALE = 16; 
const ANIMATION_SPEED_MS = 120; // ~8 FPS

// Animation Tracking State
let frames = []; 
let currentFrameIndex = 0;
let isPlaying = false;
let playInterval = null;
let onionSkinEnabled = false;

// Tool State Engine
let currentTool = 'pencil';
let isDrawing = false;
let startX = null, startY = null;
let lastX = null, lastY = null;
let currentBrushSize = 1;

// Undo/Redo Stacks
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 20;

// Force default ink color to black on startup
colorPicker.value = '#000000';

// Initialize Core App Sandbox
setupFirstFrame();
updateContainerDimensions(canvas.width, canvas.height);

function setupFirstFrame() {
    ctx.clearRect(0,0, canvas.width, canvas.height);
    frames = [canvas.toDataURL()];
    currentFrameIndex = 0;
    saveState();
    renderTimeline();
}

// Tool Map Configuration
const toolMap = {
    'pencil': document.getElementById('tool-pencil'),
    'eraser': document.getElementById('tool-eraser'),
    'bucket': document.getElementById('tool-bucket'),
    'eyedropper': document.getElementById('tool-eyedropper'),
    'rect': document.getElementById('tool-rect'),
    'circle': document.getElementById('tool-circle')
};

function setTool(toolName) {
    if (!toolMap[toolName]) return;
    Object.values(toolMap).forEach(btn => btn.classList.remove('active'));
    toolMap[toolName].classList.add('active');
    currentTool = toolName;
}

Object.keys(toolMap).forEach(tool => {
    toolMap[tool].addEventListener('click', () => setTool(tool));
});

brushSizeInput.addEventListener('input', (e) => {
    currentBrushSize = parseInt(e.target.value) || 1;
    brushSizeDisplay.textContent = `${currentBrushSize}px`;
});

// KEYBOARD ENGINE
window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
        return;
    }
    switch (e.key.toLowerCase()) {
        case 'l': e.preventDefault(); toggleOnionSkin(); break;
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'b': setTool('pencil'); break;
        case 'e': setTool('eraser'); break;
        case 'g': setTool('bucket'); break;
        case 'i': setTool('eyedropper'); break;
        case 'u': setTool(currentTool === 'rect' ? 'circle' : 'rect'); break;
    }
});

function getGridCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / canvas.width));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / canvas.height));
    return { x, y };
}

// ONION SKIN RENDERING
function toggleOnionSkin() {
    onionSkinEnabled = !onionSkinEnabled;
    onionBtn.textContent = `🧅 Onion Skin: ${onionSkinEnabled ? 'ON' : 'OFF'}`;
    if (onionSkinEnabled) onionBtn.classList.add('active');
    else onionBtn.classList.remove('active');
    renderOnionSkinLayer();
}

function renderOnionSkinLayer() {
    oCtx.clearRect(0, 0, onionCanvas.width, onionCanvas.height);
    if (onionSkinEnabled && currentFrameIndex > 0) {
        const prevFrameImg = new Image();
        prevFrameImg.src = frames[currentFrameIndex - 1];
        prevFrameImg.onload = () => { oCtx.drawImage(prevFrameImg, 0, 0); };
    }
}

// TIMELINE RENDERING WITH LIVE PREVIEWS & NUMBERS ABOVE
function renderTimeline() {
    frameStrip.innerHTML = '';
    frames.forEach((frameData, idx) => {
        // Wrapper container for the column layout (Number on top, frame on bottom)
        const frameWrapper = document.createElement('div');
        frameWrapper.style.display = 'flex';
        frameWrapper.style.flexDirection = 'column';
        frameWrapper.style.alignItems = 'center';
        frameWrapper.style.gap = '4px';

        // Label element for frame number positioned above
        const frameLabel = document.createElement('span');
        frameLabel.textContent = idx + 1;
        frameLabel.style.fontSize = '12px';
        frameLabel.style.fontWeight = 'bold';
        frameLabel.style.color = idx === currentFrameIndex ? '#007acc' : '#888';

        // Clickable box card container
        const frameCard = document.createElement('div');
        frameCard.className = `timeline-frame-card ${idx === currentFrameIndex ? 'active-frame' : ''}`;
        
        // Thumbnail image processing inside the frame card
        const thumbImg = document.createElement('img');
        thumbImg.src = frameData;
        thumbImg.style.width = '100%';
        thumbImg.style.height = '100%';
        thumbImg.style.objectFit = 'contain';
        thumbImg.style.imageRendering = 'pixelated'; // Keeps pixel art crisp

        frameCard.appendChild(thumbImg);
        frameCard.addEventListener('click', () => switchFrame(idx));
        
        frameWrapper.appendChild(frameLabel);
        frameWrapper.appendChild(frameCard);
        frameStrip.appendChild(frameWrapper);
    });
}

function switchFrame(index) {
    if (isPlaying) togglePlay();
    frames[currentFrameIndex] = canvas.toDataURL();
    currentFrameIndex = index;
    loadFrameData(frames[currentFrameIndex]);
    renderTimeline();
}

function loadFrameData(dataURL) {
    const img = new Image();
    img.src = dataURL;
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        renderOnionSkinLayer();
        undoStack = [canvas.toDataURL()];
        redoStack = [];
    };
}

// PLAYBACK MANAGER
function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) {
        frames[currentFrameIndex] = canvas.toDataURL(); 
        playBtn.textContent = '⏸ Pause';
        playBtn.classList.add('active');
        playInterval = setInterval(() => {
            currentFrameIndex = (currentFrameIndex + 1) % frames.length;
            loadFrameData(frames[currentFrameIndex]);
            renderTimeline();
        }, ANIMATION_SPEED_MS); 
    } else {
        clearInterval(playInterval);
        playBtn.textContent = '▶ Play';
        playBtn.classList.remove('active');
    }
}

addFrameBtn.addEventListener('click', () => {
    frames[currentFrameIndex] = canvas.toDataURL();
    frames.splice(currentFrameIndex + 1, 0, canvas.toDataURL());
    currentFrameIndex++;
    loadFrameData(frames[currentFrameIndex]);
    renderTimeline();
});

deleteFrameBtn.addEventListener('click', () => {
    if (frames.length <= 1) return;
    frames.splice(currentFrameIndex, 1);
    currentFrameIndex = Math.max(0, currentFrameIndex - 1);
    loadFrameData(frames[currentFrameIndex]);
    renderTimeline();
});

onionBtn.addEventListener('click', toggleOnionSkin);
playBtn.addEventListener('click', togglePlay);

// --- DRAWING FUNCTIONS ---
function drawPixelBlock(targetCtx, centerX, centerY, size, color, isEraser = false) {
    const radius = Math.floor(size / 2);
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (size > 2 && (dx*dx + dy*dy) > (radius * radius + 0.5)) continue;
            const targetX = centerX + dx;
            const targetY = centerY + dy;
            if (targetX < 0 || targetX >= canvas.width || targetY < 0 || targetY >= canvas.height) continue;
            if (isEraser) targetCtx.clearRect(targetX, targetY, 1, 1);
            else { targetCtx.fillStyle = color; targetCtx.fillRect(targetX, targetY, 1, 1); }
        }
    }
}

function drawLine(targetCtx, x0, y0, x1, y1, size, color, isEraser = false) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1, sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;
    while (true) {
        drawPixelBlock(targetCtx, x0, y0, size, color, isEraser);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

function drawRectangle(targetCtx, x0, y0, x1, y1, color) {
    const left = Math.min(x0, x1), right = Math.max(x0, x1);
    const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
    for (let x = left; x <= right; x++) { drawPixelBlock(targetCtx, x, top, 1, color); drawPixelBlock(targetCtx, x, bottom, 1, color); }
    for (let y = top; y <= bottom; y++) { drawPixelBlock(targetCtx, left, y, 1, color); drawPixelBlock(targetCtx, right, y, 1, color); }
}

function drawCircle(targetCtx, xc, yc, x1, y1, color) {
    const r = Math.round(Math.sqrt(Math.pow(x1 - xc, 2) + Math.pow(y1 - yc, 2)));
    let x = 0, y = r, d = 3 - 2 * r;
    const sym = (xc, yc, x, y) => {
        drawPixelBlock(targetCtx, xc + x, yc + y, 1, color); drawPixelBlock(targetCtx, xc - x, yc + y, 1, color);
        drawPixelBlock(targetCtx, xc + x, yc - y, 1, color); drawPixelBlock(targetCtx, xc - x, yc - y, 1, color);
        drawPixelBlock(targetCtx, xc + y, yc + x, 1, color); drawPixelBlock(targetCtx, xc - y, yc + x, 1, color);
        drawPixelBlock(targetCtx, xc + y, yc - x, 1, color); drawPixelBlock(targetCtx, xc - y, yc - x, 1, color);
    };
    sym(xc, yc, x, y);
    while (y >= x) { x++; if (d > 0) { y--; d = d + 4 * (x - y) + 10; } else d = d + 4 * x + 6; sym(xc, yc, x, y); }
}

function floodFill(startX, startY, fillColor) {
    const targetColor = ctx.getImageData(startX, startY, 1, 1).data;
    const fillRGB = hexToRgb(fillColor);
    if (matchColor(targetColor, fillRGB)) return;
    const queue = [[startX, startY]], w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h), d = imgData.data;
    while (queue.length > 0) {
        const [x, y] = queue.shift(); if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const o = (y * w + x) * 4;
        if (matchColor([d[o], d[o+1], d[o+2], d[o+3]], targetColor)) {
            d[o] = fillRGB[0]; d[o+1] = fillRGB[1]; d[o+2] = fillRGB[2]; d[o+3] = 255;
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }
    ctx.putImageData(imgData, 0, 0);
    frames[currentFrameIndex] = canvas.toDataURL();
    saveState();
}

function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16), 255] : [0,0,0,255];
}
function matchColor(c1, c2) { return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3]; }

function updateContainerDimensions(w, h) {
    const container = document.querySelector('.canvas-container');
    container.style.width = `${w * PIXEL_SCALE}px`;
    container.style.height = `${h * PIXEL_SCALE}px`;
    statusDim.textContent = `${w} × ${h} px`;
}

function resizeCanvas(newWidth, newHeight) {
    canvas.width = newWidth; canvas.height = newHeight;
    previewCanvas.width = newWidth; previewCanvas.height = newHeight;
    onionCanvas.width = newWidth; onionCanvas.height = newHeight;
    updateContainerDimensions(newWidth, newHeight);
    setupFirstFrame();
}

// --- CLEAN EXPORT ENGINES ---
function exportNativeVideo(scaleFactor = 16) {
    if (isPlaying) togglePlay();
    statusCoords.textContent = "Generating Video File...";

    const recCanvas = document.createElement('canvas');
    recCanvas.width = canvas.width * scaleFactor;
    recCanvas.height = canvas.height * scaleFactor;
    const rCtx = recCanvas.getContext('2d');
    rCtx.imageSmoothingEnabled = false;

    const stream = recCanvas.captureStream(0); 
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' }); 
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'pixsprite-animation.mp4';
        link.href = url;
        link.click();
        statusCoords.textContent = "MP4 Downloaded! Use EzGIF.com to convert to GIF if needed.";
    };

    mediaRecorder.start();

    let currentIdx = 0;
    function renderNextFrameToStream() {
        if (currentIdx >= frames.length) {
            setTimeout(() => mediaRecorder.stop(), 50);
            return;
        }

        const img = new Image();
        img.src = frames[currentIdx];
        img.onload = () => {
            rCtx.clearRect(0, 0, recCanvas.width, recCanvas.height);
            rCtx.drawImage(img, 0, 0, canvas.width, canvas.height, 0, 0, recCanvas.width, recCanvas.height);
            stream.getVideoTracks()[0].requestFrame();
            currentIdx++;
            setTimeout(renderNextFrameToStream, ANIMATION_SPEED_MS);
        };
    }
    renderNextFrameToStream();
}

function exportCrispSpritesheet(scaleFactor = 16) {
    if (isPlaying) togglePlay();
    statusCoords.textContent = "Generating Sprite Sheet PNG...";

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = (canvas.width * frames.length) * scaleFactor;
    exportCanvas.height = canvas.height * scaleFactor;
    const eCtx = exportCanvas.getContext('2d');
    eCtx.imageSmoothingEnabled = false;

    let loadedCount = 0;
    frames.forEach((frameData, index) => {
        const img = new Image();
        img.src = frameData;
        img.onload = () => {
            eCtx.drawImage(img, 0, 0, canvas.width, canvas.height, (index * canvas.width * scaleFactor), 0, canvas.width * scaleFactor, canvas.height * scaleFactor);
            loadedCount++;
            if (loadedCount === frames.length) {
                const link = document.createElement('a');
                link.download = `pixsprite-sheet.png`;
                link.href = exportCanvas.toDataURL('image/png');
                link.click();
                statusCoords.textContent = "Sprite Sheet PNG Downloaded!";
            }
        };
    });
}

// --- HISTORICAL UNDO/REDO LOGIC ---
function saveState() {
    redoStack = [];
    if (undoStack.length >= MAX_HISTORY) undoStack.shift();
    undoStack.push(canvas.toDataURL());
    frames[currentFrameIndex] = canvas.toDataURL();
}

function undo() {
    if (undoStack.length <= 1) return;
    redoStack.push(undoStack.pop());
    restoreState(undoStack[undoStack.length - 1]);
}

function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop();
    undoStack.push(next);
    restoreState(next);
}

function restoreState(dataURL) {
    const img = new Image();
    img.src = dataURL;
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        frames[currentFrameIndex] = dataURL;
        renderTimeline(); // Updates previews on undo/redo actions
    };
}

// MOUSE INTERACTION CAPTURE LOOP
canvas.addEventListener('mousedown', (e) => {
    if (isPlaying) togglePlay();
    const { x, y } = getGridCoords(e);
    isDrawing = true;
    startX = x; startY = y; lastX = x; lastY = y;

    if (currentTool === 'pencil') drawPixelBlock(ctx, x, y, currentBrushSize, colorPicker.value, false);
    else if (currentTool === 'eraser') drawPixelBlock(ctx, x, y, currentBrushSize, null, true);
    else if (currentTool === 'bucket') floodFill(x, y, colorPicker.value);
    else if (currentTool === 'eyedropper') {
        const data = ctx.getImageData(x, y, 1, 1).data;
        if (data[3] !== 0) colorPicker.value = "#" + ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1);
    }
});

canvas.addEventListener('mousemove', (e) => {
    const { x, y } = getGridCoords(e);
    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        statusCoords.textContent = `X: ${x}  Y: ${y} | Frame: ${currentFrameIndex + 1}/${frames.length} | Tool: ${currentTool.toUpperCase()}`;
    }
    if (!isDrawing) return;

    if (currentTool === 'pencil') { drawLine(ctx, lastX, lastY, x, y, currentBrushSize, colorPicker.value, false); lastX = x; lastY = y; }
    else if (currentTool === 'eraser') { drawLine(ctx, lastX, lastY, x, y, currentBrushSize, null, true); lastX = x; lastY = y; }
    else if (currentTool === 'rect') { pCtx.clearRect(0,0, previewCanvas.width, previewCanvas.height); drawRectangle(pCtx, startX, startY, x, y, colorPicker.value); }
    else if (currentTool === 'circle') { pCtx.clearRect(0,0, previewCanvas.width, previewCanvas.height); drawCircle(pCtx, startX, startY, x, y, colorPicker.value); }
});

window.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentTool === 'rect' || currentTool === 'circle') { ctx.drawImage(previewCanvas, 0, 0); pCtx.clearRect(0,0, previewCanvas.width, previewCanvas.height); }
    if (currentTool !== 'eyedropper') {
        saveState();
        renderTimeline(); // Updates previews dynamically on paint release
    }
});

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.getElementById('clearBtn').addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); saveState(); renderTimeline(); });
resizeBtn.addEventListener('click', () => { resizeCanvas(Math.max(8, Math.min(128, parseInt(widthInput.value)||32)), Math.max(8, Math.min(128, parseInt(heightInput.value)||32))); });

// UI ROUTER EXPORT INTERFACE
saveBtn.addEventListener('click', () => {
    frames[currentFrameIndex] = canvas.toDataURL(); 
    const selectedFormat = exportFormatSelect.value;
    
    if (selectedFormat === 'mp4') {
        exportNativeVideo(16); 
    } else if (selectedFormat === 'sheet') {
        exportCrispSpritesheet(16);
    }
});