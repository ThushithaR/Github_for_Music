let mediaRecorder;
let mediaStream = null;
let isCapturing = false;
let captureAutoMode = false;
let chunks = [];
let recordingActive = false;
let selectedTargetId = null;
let currentChainHeadId = null;
let connectMode = false;
let connectParentId = null;
let connectChildId = null;
let network = null; // For graph visualization
let audioContext = null;
let analyser = null;
let sourceNode = null;
let scriptProcessor = null;
let silentGain = null;
let animationFrameId = null;
let waveformCanvas = null;
let waveformCtx = null;
let vadActive = false;
let vadLastVoiceTime = 0;
let vadSpeechStart = 0;
let audioSamples = [];
let sampleRate = 44100;
const vadThreshold = 0.13;
const vadSilenceMs = 900;
const vadMinSpeechMs = 400;
let mergeSelectedIds = [];
let graphState = {
    nodesById: new Map(),
    childrenById: new Map(),
    depthById: new Map(),
};
let traversalActive = false;
let traversalChoiceResolver = null;
let traversalAudio = new Audio();

traversalAudio.preload = 'auto';

function getDepthColor(depth) {
    const hue = (depth * 58) % 360;
    return `hsl(${hue}, 70%, 52%)`;
}

function getDepthFill(depth) {
    const hue = (depth * 58) % 360;
    return `hsla(${hue}, 80%, 94%, 1)`;
}

function buildGraphState(data) {
    const nodesById = new Map();
    const childrenById = new Map();
    const depthById = new Map();

    data.forEach(node => {
        nodesById.set(node.id, node);
        if (!childrenById.has(node.id)) {
            childrenById.set(node.id, []);
        }
    });

    data.forEach(node => {
        const parents = Array.isArray(node.parents) ? node.parents : [];
        parents.forEach(parentId => {
            if (!childrenById.has(parentId)) {
                childrenById.set(parentId, []);
            }
            childrenById.get(parentId).push(node.id);
        });
    });

    function resolveDepth(nodeId, trail = new Set()) {
        if (depthById.has(nodeId)) {
            return depthById.get(nodeId);
        }
        if (trail.has(nodeId)) {
            return 0;
        }

        trail.add(nodeId);
        const node = nodesById.get(nodeId);
        if (!node || !node.parents || node.parents.length === 0) {
            depthById.set(nodeId, 0);
            trail.delete(nodeId);
            return 0;
        }

        const parentDepths = node.parents
            .map(parentId => resolveDepth(parentId, trail))
            .filter(depth => Number.isFinite(depth));

        const depth = parentDepths.length ? Math.min(...parentDepths) + 1 : 0;
        depthById.set(nodeId, depth);
        trail.delete(nodeId);
        return depth;
    }

    data.forEach(node => resolveDepth(node.id));

    graphState = { nodesById, childrenById, depthById };
}

function getChildren(nodeId) {
    return graphState.childrenById.get(nodeId) || [];
}

function getNodeDepth(nodeId) {
    return graphState.depthById.get(nodeId) || 0;
}

function setTraversalPrompt(visible, titleText = '', childIds = []) {
    const prompt = document.getElementById('traversalPrompt');
    const title = document.getElementById('traversalPromptTitle');
    const choices = document.getElementById('traversalPromptChoices');

    if (!prompt || !title || !choices) {
        return;
    }

    prompt.style.display = visible ? 'block' : 'none';
    title.textContent = titleText;
    choices.innerHTML = '';

    if (visible) {
        childIds.forEach(childId => {
            const childNode = graphState.nodesById.get(childId);
            const btn = document.createElement('button');
            btn.textContent = childNode ? `${childId.substring(0, 8)}...` : childId;
            btn.onclick = () => chooseTraversalChoice(childId);
            choices.appendChild(btn);
        });
    }
}

function chooseTraversalChoice(nodeId) {
    if (traversalChoiceResolver) {
        const resolver = traversalChoiceResolver;
        traversalChoiceResolver = null;
        setTraversalPrompt(false);
        resolver(nodeId);
    }
}

function cancelTraversalChoice() {
    traversalActive = false;
    traversalChoiceResolver = null;
    traversalAudio.pause();
    traversalAudio.currentTime = 0;
    setTraversalPrompt(false);
    showStatus('Traversal canceled.');
}

function stopTraversal() {
    traversalActive = false;
    traversalChoiceResolver = null;
    traversalAudio.pause();
    traversalAudio.currentTime = 0;
    setTraversalPrompt(false);
    showStatus('Traversal stopped.');
}

function playTraversalAudio(nodeId) {
    const node = graphState.nodesById.get(nodeId);
    if (!node || !node.file) {
        return Promise.resolve();
    }

    const filePath = node.file.startsWith('/') ? node.file : `/${node.file}`;
    traversalAudio.pause();
    traversalAudio.currentTime = 0;
    traversalAudio.src = `http://localhost:8000${filePath}`;

    return new Promise(resolve => {
        const finish = () => {
            traversalAudio.onended = null;
            traversalAudio.onerror = null;
            resolve();
        };

        traversalAudio.onended = finish;
        traversalAudio.onerror = finish;
        traversalAudio.play().catch(finish);
    });
}

async function traverseNode(nodeId) {
    if (!traversalActive) {
        return;
    }

    const node = graphState.nodesById.get(nodeId);
    if (!node) {
        return;
    }

    showStatus(`Traversing: ${nodeId.substring(0, 8)}...`);
    await playTraversalAudio(nodeId);

    if (!traversalActive) {
        return;
    }

    const children = getChildren(nodeId);
    if (children.length === 0) {
        showStatus('Traversal finished.');
        traversalActive = false;
        return;
    }

    if (children.length === 1) {
        await traverseNode(children[0]);
        return;
    }

    const choice = await new Promise(resolve => {
        traversalChoiceResolver = resolve;
        setTraversalPrompt(true, `Choose next path from ${nodeId.substring(0, 8)}...`, children);
    });

    if (traversalActive && choice) {
        await traverseNode(choice);
    }
}

async function startTraversalFrom(nodeId) {
    traversalActive = true;
    traversalChoiceResolver = null;
    setTraversalPrompt(false);
    await traverseNode(nodeId);
}

function toggleMergeNode(nodeId) {
    if (mergeSelectedIds.includes(nodeId)) {
        mergeSelectedIds = mergeSelectedIds.filter(id => id !== nodeId);
    } else {
        if (mergeSelectedIds.length >= 2) {
            mergeSelectedIds.shift();
        }
        mergeSelectedIds.push(nodeId);
    }
    loadIdeas();
}

function clearMergeSelection() {
    mergeSelectedIds = [];
    loadIdeas();
}

async function mergeSelectedNodes() {
    if (mergeSelectedIds.length !== 2) {
        alert('Select exactly two nodes to merge.');
        return;
    }

    const [leftId, rightId] = mergeSelectedIds;

    try {
        const res = await fetch(`http://localhost:8000/merge/${leftId}/${rightId}`, {
            method: 'POST'
        });
        const data = await res.json();

        if (!res.ok || data.detail) {
            throw new Error(data.detail || 'Merge failed');
        }

        mergeSelectedIds = [];
        showStatus(`Merged ${leftId.substring(0, 8)}... + ${rightId.substring(0, 8)}...`);
        await loadIdeas();
    } catch (err) {
        console.error('Error merging nodes:', err);
        alert('Error merging nodes: ' + err);
    }
}

async function forkNode(nodeId) {
    try {
        const res = await fetch(`http://localhost:8000/fork/${nodeId}`, {
            method: 'POST'
        });
        const data = await res.json();

        if (!res.ok || data.detail) {
            throw new Error(data.detail || 'Fork failed');
        }

        showStatus(`Forked ${nodeId.substring(0, 8)}... into ${data.id.substring(0, 8)}...`);
        await loadIdeas();
    } catch (err) {
        console.error('Error forking node:', err);
        alert('Error forking node: ' + err);
    }
}

function formatTimestamp(isoText) {
    if (!isoText) {
        return 'Unknown';
    }
    const date = new Date(isoText);
    if (Number.isNaN(date.getTime())) {
        return isoText;
    }
    return date.toLocaleString();
}

function formatDuration(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const whole = Math.floor(safeSeconds);
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function toggleRecording() {
    if (recordingActive) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStream = stream;

        chunks = [];
        recordingActive = true;
        currentChainHeadId = null;
        vadActive = false;
        vadLastVoiceTime = Date.now();
        vadSpeechStart = 0;

        document.getElementById('toggleRecordingBtn').textContent = 'Stop Listening';
        document.getElementById('captureBtn').disabled = false;
        showStatus('Listening... recording always on. Speak any time.');

        setupWaveform(stream);
    } catch (err) {
        alert('Error accessing microphone: ' + err);
    }
}

function startMediaRecorder() {
    if (!mediaStream || !audioContext || !sourceNode) {
        return;
    }

    // Avoid stacking multiple ScriptProcessor nodes across captures.
    if (scriptProcessor) {
        return;
    }

    // Create ScriptProcessor to capture raw audio samples
    const bufferSize = 4096;
    scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    
    audioSamples = [];

    scriptProcessor.onaudioprocess = (e) => {
        // Make a copy of the input data (inputBuffer is reused, so we must copy)
        const inputData = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(inputData);
        audioSamples.push(copy);
    };

    sourceNode.connect(scriptProcessor);

    // Keep processor running without audible microphone monitoring.
    if (!silentGain) {
        silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        silentGain.connect(audioContext.destination);
    }
    scriptProcessor.connect(silentGain);
}

function stopMediaRecorder() {
    if (scriptProcessor) {
        if (sourceNode) {
            sourceNode.disconnect(scriptProcessor);
        }
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }
    if (silentGain) {
        silentGain.disconnect();
        silentGain = null;
    }
}

async function stopRecording() {
    recordingActive = false;
    stopMediaRecorder();
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    teardownWaveform();
    document.getElementById('toggleRecordingBtn').textContent = 'Start Listening';
    document.getElementById('captureBtn').disabled = true;
    showStatus('Stopped listening. Click Start Listening to resume.');
}

function setupWaveform(stream) {
    try {
        if (!waveformCanvas) {
            waveformCanvas = document.getElementById('waveformCanvas');
            waveformCtx = waveformCanvas.getContext('2d');
        }

        if (audioContext) {
            audioContext.close();
        }

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sampleRate = audioContext.sampleRate;
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);

        // Start capturing raw audio samples
        startMediaRecorder();

        drawWaveform();
    } catch (err) {
        console.error('Waveform setup failed:', err);
    }
}

function teardownWaveform() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    stopMediaRecorder();
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }
    if (analyser) {
        analyser.disconnect();
        analyser = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (waveformCtx && waveformCanvas) {
        waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    }
}

function drawWaveform() {
    if (!analyser || !waveformCtx || !waveformCanvas) {
        return;
    }

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;

    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i] - 128;
            sum += value * value;
        }

        const rms = Math.sqrt(sum / bufferLength) / 128;
        const now = Date.now();

        if (rms > vadThreshold) {
            if (!vadActive) {
                vadActive = true;
                vadSpeechStart = now;
                showStatus('Voice detected — waiting for silence to auto-capture.');
            }
            vadLastVoiceTime = now;
        }

        if (vadActive && now - vadLastVoiceTime > vadSilenceMs && now - vadSpeechStart > vadMinSpeechMs) {
            vadActive = false;
            vadSpeechStart = 0;
            captureBuffer();
        }

        waveformCtx.fillStyle = '#121212';
        waveformCtx.fillRect(0, 0, width, height);

        waveformCtx.lineWidth = 2;
        waveformCtx.strokeStyle = rms > vadThreshold ? '#4caf50' : '#888';
        waveformCtx.beginPath();

        const sliceWidth = width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * height / 2;

            if (i === 0) {
                waveformCtx.moveTo(x, y);
            } else {
                waveformCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        waveformCtx.lineTo(width, height / 2);
        waveformCtx.stroke();
    }

    draw();
}

async function captureBuffer(auto = true) {
    if (audioSamples.length === 0 || isCapturing) {
        return;
    }

    captureAutoMode = auto;
    isCapturing = true;

    // Clear current samples, capture the buffer, then restart recording
    const samplesToSend = [...audioSamples];
    audioSamples = [];

    await sendCapturedBlob(samplesToSend, captureAutoMode);
}

// WAV encoding functions
function floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function encodeWav(pcmData, sampleRate) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;

    const subChunk1Size = 16;
    const subChunk2Size = pcmData.length * bytesPerSample;
    const chunkSize = 36 + subChunk2Size;

    const buffer = new ArrayBuffer(44 + subChunk2Size);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, chunkSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, subChunk1Size, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, subChunk2Size, true);

    let pcmIndex = 0;
    let offset = 44;
    while (pcmIndex < pcmData.length) {
        view.setInt16(offset, pcmData[pcmIndex], true);
        offset += 2;
        pcmIndex++;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

async function sendCapturedBlob(samples, auto) {
    if (!samples || samples.length === 0) {
        isCapturing = false;
        if (recordingActive) {
            startMediaRecorder();
        }
        return;
    }

    try {
        // Flatten array of Float32Array chunks into a single Float32Array
        let totalLength = 0;
        for (let chunk of samples) {
            totalLength += chunk.length;
        }
        
        const float32Array = new Float32Array(totalLength);
        let offset = 0;
        for (let chunk of samples) {
            float32Array.set(chunk, offset);
            offset += chunk.length;
        }
        
        // Convert to 16-bit PCM
        const int16Array = floatTo16BitPCM(float32Array);
        
        // Encode to WAV
        const wavBlob = encodeWav(int16Array, sampleRate);
        
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');

        const parentId = selectedTargetId || currentChainHeadId;
        const url = parentId
            ? `http://localhost:8000/capture?parent_id=${parentId}`
            : 'http://localhost:8000/capture';

        const res = await fetch(url, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        console.log(`Captured audio (${auto ? 'auto' : 'manual'})! ID: ${data.id}, BPM: ${data.bpm}`);
        if (auto) {
            showStatus(`Auto-captured child idea — BPM ${data.bpm.toFixed(0)}.`);
        } else {
            alert(`Audio captured! ID: ${data.id}, BPM: ${data.bpm}`);
        }

        currentChainHeadId = data.id;
        selectedTargetId = null;
        document.getElementById('clearBranchBtn').style.display = 'none';
        audioSamples = [];
        loadIdeas();
    } catch (err) {
        console.error('Error capturing audio:', err);
        if (!auto) {
            alert('Error capturing audio: ' + err);
        }
    } finally {
        isCapturing = false;
        captureAutoMode = false;
    }
}

async function capture() {
    captureBuffer(false);
}


async function loadIdeas() {
    try {
        const res = await fetch('http://localhost:8000/nodes');
        const data = await res.json();
        buildGraphState(data);

        const container = document.getElementById('ideas-list');
        container.innerHTML = '';

        if (selectedTargetId) {
            document.getElementById('clearBranchBtn').style.display = 'inline-block';
            showStatus(`Branch target selected: ${selectedTargetId.substring(0, 8)}... — next capture will use this as parent.`);
        } else if (currentChainHeadId) {
            document.getElementById('clearBranchBtn').style.display = 'none';
            showStatus(`Continuing chain from last capture: ${currentChainHeadId.substring(0, 8)}...`);
        } else {
            document.getElementById('clearBranchBtn').style.display = 'none';
        }

        if (data.length === 0) {
            container.innerHTML += "<p>No ideas captured yet.</p>";
            visualizeGraph([]);
            return;
        }

        data.forEach(node => {
            const div = document.createElement("div");
            
            // Determine if root or branch
            const isRoot = node.parents.length === 0;
            const depth = getNodeDepth(node.id);
            const depthColor = getDepthColor(depth);
            div.className = "idea-node " + (isRoot ? "root" : "branch");
            div.style.borderColor = depthColor;
            div.style.background = getDepthFill(depth);
            if (connectParentId === node.id) {
                div.className += " selected-parent";
            }
            if (connectChildId === node.id) {
                div.className += " selected-child";
            }
            if (mergeSelectedIds.includes(node.id)) {
                div.className += " selected-parent";
            }

            let audioHtml = "";
            if (node.file) {
                audioHtml = `<audio controls src="http://localhost:8000/${node.file}"></audio>`;
            } else {
                audioHtml = `<p style="color: #999;"><em>No audio yet</em></p>`;
            }

            let parentInfo = "";
            if (!isRoot) {
                parentInfo = `<p style="color: #666;"><strong>Parent:</strong> ${node.parents[0].substring(0, 8)}...</p>`;
            } else {
                parentInfo = `<p style="color: #d32f2f;"><strong>🌱 Root Idea</strong></p>`;
            }

            const selectedText = selectedTargetId === node.id || currentChainHeadId === node.id ? 'Selected parent' : 'Record child from this idea';
            let branchButton = `<button onclick="selectBranchTarget('${node.id}')">${selectedText}</button>`;
            let deleteButton = `<button onclick="deleteRecording('${node.id}')" style="background:#b71c1c; color:#fff;">Delete Recording</button>`;
            let forkButton = `<button onclick="forkNode('${node.id}')">Fork Node</button>`;
            let playButton = `<button onclick="startTraversalFrom('${node.id}')">Play Path From Here</button>`;
            let mergeButton = `<button onclick="toggleMergeNode('${node.id}')">${mergeSelectedIds.includes(node.id) ? 'Unselect Merge' : 'Select For Merge'}</button>`;

            div.innerHTML = `
                <p><strong>ID:</strong> ${node.id.substring(0, 8)}...</p>
                <p><strong>BPM:</strong> ${node.bpm.toFixed(2)}</p>
                <p><strong>Key:</strong> ${node.musical_key || 'Unknown'}</p>
                <p><strong>Mood:</strong> ${node.mood || 'neutral'}</p>
                <p><strong>Duration:</strong> ${formatDuration(node.duration || 0)}</p>
                <p><strong>Timestamp:</strong> ${formatTimestamp(node.created_at)}</p>
                ${parentInfo}
                ${audioHtml}
                ${branchButton}
                ${forkButton}
                ${playButton}
                ${mergeButton}
                ${deleteButton}
            `;

            container.appendChild(div);
        });

        // Visualize the graph
        visualizeGraph(data);
    } catch (err) {
        console.error('Error loading ideas:', err);
    }
}

function selectBranchTarget(nodeId) {
    selectedTargetId = nodeId;
    document.getElementById('clearBranchBtn').style.display = 'inline-block';
    showStatus(`Branch target selected: ${nodeId.substring(0, 8)}...`);
    loadIdeas();
}

function clearBranchSelection() {
    selectedTargetId = null;
    document.getElementById('clearBranchBtn').style.display = 'none';
    showStatus('Branch target cleared.');
    loadIdeas();
}

function showStatus(message) {
    const status = document.getElementById('recordStatus');
    status.textContent = message;
    status.style.display = 'block';
}

async function deleteRecording(nodeId) {
    const confirmed = confirm('Delete this recording and remove it from the database?');
    if (!confirmed) {
        return;
    }

    try {
        const res = await fetch(`http://localhost:8000/nodes/${nodeId}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(body || 'Delete failed');
        }

        if (selectedTargetId === nodeId) {
            selectedTargetId = null;
        }
        if (currentChainHeadId === nodeId) {
            currentChainHeadId = null;
        }

        showStatus(`Deleted recording ${nodeId.substring(0, 8)}...`);
        await loadIdeas();
    } catch (err) {
        console.error('Error deleting recording:', err);
        alert('Error deleting recording: ' + err);
    }
}

function toggleConnectMode() {
    connectMode = !connectMode;
    connectParentId = null;
    connectChildId = null;
    const btn = document.getElementById('toggleConnectBtn');
    btn.textContent = connectMode ? 'Stop Connect Mode' : 'Start Connect Mode';
    document.getElementById('doConnectBtn').style.display = connectMode ? 'inline-block' : 'none';
    document.getElementById('cancelConnectBtn').style.display = connectMode ? 'inline-block' : 'none';
    showStatus(connectMode ? 'Connect mode on: click parent, then child node.' : 'Connect mode off.');
}

function selectConnectNode(nodeId) {
    if (!connectMode) {
        return;
    }

    if (!connectParentId) {
        connectParentId = nodeId;
        showStatus(`Parent selected: ${nodeId.substring(0, 8)}... Now click child node.`);
        return;
    }

    if (!connectChildId) {
        if (nodeId === connectParentId) {
            showStatus('Child cannot be the same node. Click a different node.');
            return;
        }
        connectChildId = nodeId;
        showStatus(`Child selected: ${nodeId.substring(0, 8)}... Click Connect Selected Nodes.`);
        return;
    }

    connectParentId = nodeId;
    connectChildId = null;
    showStatus(`Parent changed to ${nodeId.substring(0, 8)}... Now click child node.`);
}

function connectSelectedNodes() {
    if (!connectParentId || !connectChildId) {
        alert('Select both parent and child nodes first.');
        return;
    }

    fetch(`http://localhost:8000/connect/${connectChildId}/${connectParentId}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatus(`Connected ${connectParentId.substring(0, 8)}... → ${connectChildId.substring(0, 8)}...`);
            connectParentId = null;
            connectChildId = null;
            loadIdeas();
        } else {
            const message = data.message || 'Connection failed.';
            showStatus(message);
            if (data.needsFork) {
                alert(message + ' Use Fork Node on the newer node, then connect to the fork.');
            }
        }
    })
    .catch(err => {
        console.error('Error connecting nodes:', err);
        showStatus('Error connecting nodes.');
    });
}

function cancelConnectMode() {
    connectMode = false;
    connectParentId = null;
    connectChildId = null;
    const btn = document.getElementById('toggleConnectBtn');
    btn.textContent = 'Start Connect Mode';
    document.getElementById('doConnectBtn').style.display = 'none';
    document.getElementById('cancelConnectBtn').style.display = 'none';
    showStatus('Connect mode canceled.');
}

function visualizeGraph(data) {
    // Build nodes and edges for vis.js
    const nodes = [];
    const edges = [];

    data.forEach(node => {
        const isRoot = node.parents.length === 0;
        const depth = getNodeDepth(node.id);
        const label = `${node.id.substring(0, 8)}...\nL${depth} BPM: ${node.bpm.toFixed(1)}\n${node.musical_key || 'Unknown'} | ${node.mood || 'neutral'}`;
        const nodeColor = getDepthColor(depth);
        
        nodes.push({
            id: node.id,
            label: label,
            color: {
                background: nodeColor,
                border: isRoot ? "#7f1d1d" : "#1e3a8a",
                highlight: {
                    background: nodeColor,
                    border: "#111827"
                }
            },
            title: `<strong>${isRoot ? "Root Idea" : "Branch"}</strong><br/>ID: ${node.id}<br/>BPM: ${node.bpm.toFixed(2)}<br/>Key: ${node.musical_key || 'Unknown'}<br/>Mood: ${node.mood || 'neutral'}<br/>Duration: ${formatDuration(node.duration || 0)}<br/>Created: ${formatTimestamp(node.created_at)}${node.file ? "<br/>Has audio ✓" : "<br/>No audio yet"}`,
            font: { size: 12, color: "#fff" },
            shape: "box",
            margin: 10
        });

        // Add edges from parents to this node
        if (node.parents.length > 0) {
            node.parents.forEach(parentId => {
                edges.push({
                    from: parentId,
                    to: node.id,
                    arrows: "to",
                    color: { color: "#666", highlight: "#333" },
                    smooth: { type: "cubicBezier" }
                });
            });
        }
    });

    const container = document.getElementById("network");
    const graphData = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
    };

    const options = {
        physics: {
            enabled: true,
            stabilization: { iterations: 200 }
        },
        layout: {
            hierarchical: {
                enabled: true,
                levelSeparation: 150,
                nodeSpacing: 150,
                direction: "UD"
            }
        },
        interaction: {
            navigationButtons: true,
            keyboard: true,
            dragNodes: true,
            dragView: true
        }
    };

    if (network) {
        network.destroy();
    }

    network = new vis.Network(container, graphData, options);

    // Click to select parent/child nodes when connect mode is on
    network.on('click', function(event) {
        if (!connectMode || !event.nodes || event.nodes.length === 0) {
            return;
        }
        selectConnectNode(event.nodes[0]);
    });

    // Add hover event listeners for audio playback
    network.on("hoverNode", function(event) {
        const nodeId = event.node;
        const nodeData = data.find(n => n.id === nodeId);

        if (nodeData) {
            const previewDiv = document.getElementById("audioPreview");
            const audioElement = document.getElementById("previewAudio");
            const isRoot = nodeData.parents.length === 0;

            document.getElementById("previewTitle").textContent = `${isRoot ? "🌱" : "🌿"} ${nodeId.substring(0, 8)}...`;
            document.getElementById("previewBpm").innerHTML = `<strong>BPM:</strong> ${nodeData.bpm.toFixed(2)}`;

            if (nodeData.file) {
                const filePath = nodeData.file.startsWith('/') ? nodeData.file : '/' + nodeData.file;
                audioElement.src = `http://localhost:8000${filePath}`;
                audioElement.style.display = "block";
                audioElement.autoplay = true;
                audioElement.load();
                document.getElementById("previewStatus").textContent = "▶️ Playing audio preview...";
                console.log("Loading audio from:", audioElement.src);

                audioElement.play().catch(err => {
                    console.warn("Hover audio autoplay blocked:", err);
                    document.getElementById("previewStatus").textContent = "⚠️ Click play to hear this idea";
                });
            } else {
                audioElement.src = "";
                audioElement.style.display = "none";
                document.getElementById("previewStatus").textContent = "⚠️ No audio recorded for this idea yet";
            }

            previewDiv.style.display = "block";
        }
    });

    network.on("blurNode", function() {
        document.getElementById("audioPreview").style.display = "none";
    });
}

// Branch button now selects a parent idea for the next capture, no placeholder node creation needed.

window.onload = loadIdeas;
