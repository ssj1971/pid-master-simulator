const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const pidChartCtx = document.getElementById('pidChart').getContext('2d');

// Simulation State
let robot = {
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    omega: 0, // angular velocity
    history: []
};

let line = [];
let params = {
    kp: 1.5,
    ki: 0.05,
    kd: 2.5,
    baseSpeed: 80,
    friction: 0.1
};

let pid = {
    error: 0,
    prevError: 0,
    integral: 0
};

let chartData = {
    labels: [],
    datasets: [{
        label: 'Error',
        data: [],
        borderColor: '#ef4444',
        borderWidth: 2,
        fill: false,
        tension: 0.4
    }, {
        label: 'Correction',
        data: [],
        borderColor: '#38bdf8',
        borderWidth: 2,
        fill: false,
        tension: 0.4
    }]
};

const pidChart = new Chart(pidChartCtx, {
    type: 'line',
    data: chartData,
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { display: false },
            y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
        },
        plugins: {
            legend: { labels: { color: '#f8fafc' } }
        },
        animation: false
    }
});

// Initialize Track
function initTrack() {
    line = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 50;
    
    // Create a complex wavy track
    for (let i = 0; i < 360; i += 1) {
        let r = radius + Math.sin(i * 0.1) * 30 + Math.cos(i * 0.05) * 20;
        let x = centerX + Math.cos(i * Math.PI / 180) * r;
        let y = centerY + Math.sin(i * Math.PI / 180) * r;
        line.push({ x, y });
    }
    
    robot.x = line[0].x;
    robot.y = line[0].y;
    robot.angle = 0;
}

function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    initTrack();
}

window.addEventListener('resize', resize);
resize();

// UI Controls
['kp', 'ki', 'kd', 'speed', 'friction'].forEach(id => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(`${id}-val`);
    el.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        params[id === 'speed' ? 'baseSpeed' : id] = val;
        valEl.textContent = val;
    });
});

document.getElementById('reset-btn').addEventListener('click', () => {
    robot.history = [];
    pid.integral = 0;
    pid.prevError = 0;
    chartData.labels = [];
    chartData.datasets[0].data = [];
    chartData.datasets[1].data = [];
    initTrack();
});

// Simulation Loop
function update() {
    // 1. Find the nearest point on the line
    let minDist = Infinity;
    let nearestIdx = 0;
    
    for (let i = 0; i < line.length; i++) {
        let d = Math.sqrt((robot.x - line[i].x)**2 + (robot.y - line[i].y)**2);
        if (d < minDist) {
            minDist = d;
            nearestIdx = i;
        }
    }

    // 2. Calculate Cross Track Error (CTE)
    // For simplicity, we use the distance to the nearest point as error, 
    // but with a sign based on which side the robot is on.
    const p1 = line[nearestIdx];
    const p2 = line[(nearestIdx + 1) % line.length];
    
    // Vector of the line segment
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    // Vector from line to robot
    const rdx = robot.x - p1.x;
    const rdy = robot.y - p1.y;
    
    // Cross product to find side
    const crossProduct = dx * rdy - dy * rdx;
    pid.error = crossProduct / 10; // Normalize

    // 3. PID Calculation
    pid.integral += pid.error;
    const derivative = pid.error - pid.prevError;
    const correction = (params.kp * pid.error) + (params.ki * pid.integral) + (params.kd * derivative);
    pid.prevError = pid.error;

    // 4. Robot Physics
    // Base speed + differential steering logic simplified
    const turn = correction * 0.05;
    robot.angle += turn;
    
    const velocity = (params.baseSpeed / 50);
    robot.x += Math.cos(robot.angle) * velocity;
    robot.y += Math.sin(robot.angle) * velocity;

    // UI Updates
    document.getElementById('stat-error').textContent = pid.error.toFixed(2);
    document.getElementById('stat-correction').textContent = correction.toFixed(2);

    // Chart Update
    if (Date.now() % 5 === 0) {
        chartData.labels.push('');
        chartData.datasets[0].data.push(pid.error);
        chartData.datasets[1].data.push(correction);
        if (chartData.labels.length > 50) {
            chartData.labels.shift();
            chartData.datasets[0].data.shift();
            chartData.datasets[1].data.shift();
        }
        pidChart.update();
    }

    draw();
    requestAnimationFrame(update);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Track
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 20;
    ctx.lineJoin = 'round';
    ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i++) {
        ctx.lineTo(line[i].x, line[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw Line (the actual sensing path)
    ctx.beginPath();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i++) {
        ctx.lineTo(line[i].x, line[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Robot
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.angle);
    
    // Shadow
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    
    // Body
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(-15, -10, 30, 20, 4);
    ctx.fill();
    
    // Front Indicator
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, -2, 5, 4);
    
    ctx.restore();
}

update();
