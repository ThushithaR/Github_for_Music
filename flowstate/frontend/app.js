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
let animationFrameId = null;
let waveformCanvas = null;
let waveformCtx = null;
let vadActive = false;
let vadLastVoiceTime = 0;
let vadSpeechStart = 0;
const vadThreshold = 0.13;
const vadSilenceMs = 900;
const vadMinSpeechMs = 400;

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
        selectedTargetId = null;
        currentChainHeadId = null;
        vadActive = false;
        vadLastVoiceTime = Date.now();
        vadSpeechStart = 0;

        startMediaRecorder();

        document.getElementById('toggleRecordingBtn').textContent = 'Stop Listening';
        document.getElementById('captureBtn').disabled = false;
        showStatus('Listening... recording always on. Speak any time.');

        setupWaveform(stream);
    } catch (err) {
        alert('Error accessing microphone: ' + err);
    }
}

function startMediaRecorder() {
    if (!mediaStream) {
        return;
    }

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm;codecs=opus' });
    chunks = [];

    mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
        if (chunks.length === 0) {
            if (recordingActive) {
                startMediaRecorder();
            }
            return;
        }

        await sendCapturedBlob(captureAutoMode);

        if (recordingActive) {
            startMediaRecorder();
        }
    };

    mediaRecorder.start();
}

async function stopRecording() {
    recordingActive = false;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
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
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);

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
    if (!mediaRecorder || mediaRecorder.state !== 'recording' || isCapturing) {
        return;
    }

    captureAutoMode = auto;
    isCapturing = true;
    mediaRecorder.stop();
}

async function sendCapturedBlob(auto) {
    if (chunks.length === 0) {
        isCapturing = false;
        if (recordingActive) {
            startMediaRecorder();
        }
        return;
    }

    const blob = new Blob(chunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');

    const parentId = selectedTargetId || currentChainHeadId;
    const url = parentId
        ? `http://localhost:8000/capture?parent_id=${parentId}`
        : 'http://localhost:8000/capture';

    try {
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
        chunks = [];
        loadIdeas();
    } catch (err) {
        console.error('Error capturing audio:', err);
        if (!auto) {
            alert('Error capturing audio: ' + err);
        }
    } finally {
        isCapturing = false;
        captureAutoMode = false;
        if (recordingActive) {
            startMediaRecorder();
        }
    }
}

async function capture() {
    captureBuffer(false);
}


async function loadIdeas() {
    try {
        const res = await fetch('http://localhost:8000/nodes');
        const data = await res.json();

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
            div.className = "idea-node " + (isRoot ? "root" : "branch");
            if (connectParentId === node.id) {
                div.className += " selected-parent";
            }
            if (connectChildId === node.id) {
                div.className += " selected-child";
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

            div.innerHTML = `
                <p><strong>ID:</strong> ${node.id.substring(0, 8)}...</p>
                <p><strong>BPM:</strong> ${node.bpm.toFixed(2)}</p>
                ${parentInfo}
                ${audioHtml}
                ${branchButton}
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

function showStatus(message) {
    const status = document.getElementById('recordStatus');
    status.textContent = message;
    status.style.display = 'block';
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
            showStatus('Connection failed: ' + data.message);
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
        const label = `${node.id.substring(0, 8)}...\nBPM: ${node.bpm.toFixed(1)}`;
        
        nodes.push({
            id: node.id,
            label: label,
            color: isRoot ? "#d32f2f" : "#1976d2",
            title: `<strong>${isRoot ? "Root Idea" : "Branch"}</strong><br/>ID: ${node.id}<br/>BPM: ${node.bpm.toFixed(2)}${node.file ? "<br/>Has audio ✓" : "<br/>No audio yet"}`,
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
