const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const g = 9.81; // Aceleração da gravidade (m/s²)

// --- Constantes de Configuração ---
const groundHeight = 10; // Altura visual do chão em pixels
const groundSurfaceY = canvas.height - groundHeight; // Coordenada Y da superfície do chão
const cannonBaseRadius = 15; // Raio da base do canhão em pixels
const cannonMinY = groundSurfaceY - cannonBaseRadius; // Posição Y mínima do *centro* do canhão
const maxSimHeightMeters = 100; // Altura máxima que a área de simulação representa em metros
const pixelsPerMeter = (groundSurfaceY - cannonBaseRadius) / maxSimHeightMeters; // Pixels por metro na vertical (área acima da base mínima do canhão)

// --- Variáveis de Estado ---
let isAnimating = false; // Flag para controlar se a animação está rodando
let trajectory = []; // Array para armazenar os pontos da trajetória (em pixels)
let cannonY = cannonMinY; // Posição Y inicial da base do canhão (começa no chão)
let isDragging = false; // Flag para controlar se o canhão está sendo arrastado
let dragOffsetY = 0; // Deslocamento Y do mouse em relação ao centro do canhão ao arrastar

// --- Função auxiliar para obter a posição do mouse relativa ao canvas ---
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

// --- Funções de Desenho (usam coordenadas de PIXEL) ---

function drawGround() {
    ctx.fillStyle = '#A0522D'; // Cor marrom Sienna para o chão
    ctx.fillRect(0, groundSurfaceY, canvas.width, groundHeight); // Desenha o chão
}

function drawCannon(angle, yPos) {
    ctx.save();
    ctx.translate(50, yPos); // Translada para o centro da base do canhão (pixels)

    // Desenha a estrutura de suporte
    ctx.fillStyle = '#8B4513';
    const supportWidth = 10;
    // Altura do suporte vai da base do círculo (yPos + cannonBaseRadius) até a superfície do chão (groundSurfaceY)
    const supportHeight = Math.max(0, groundSurfaceY - (yPos + cannonBaseRadius));
    ctx.fillRect(-supportWidth / 2, cannonBaseRadius, supportWidth, supportHeight);

    // Rotaciona para o ângulo
    ctx.rotate(-angle * Math.PI / 180);

    // Desenha o cano
    ctx.fillStyle = '#666';
    ctx.fillRect(0, -5, 40, 10); // Dimensões em pixels

    // Desenha a base circular
    ctx.beginPath();
    ctx.arc(0, 0, cannonBaseRadius, 0, 2 * Math.PI); // Raio em pixels
    ctx.fillStyle = '#444';
    ctx.fill();

    ctx.restore();
}

function drawProjectile(x_px, y_px) {
    ctx.beginPath();
    ctx.arc(x_px, y_px, 5, 0, 2 * Math.PI); // Tamanho do projétil em pixels
    ctx.fillStyle = 'red';
    ctx.fill();
}

function drawTrajectory() {
    if (trajectory.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(trajectory[0].x, trajectory[0].y); // Pontos da trajetória são em pixels
    for (let i = 1; i < trajectory.length; i++) {
        ctx.lineTo(trajectory[i].x, trajectory[i].y);
    }
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.stroke();
}

// --- Função para Redesenhar a Cena ---
function redrawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround();
    const currentAngle = Number(document.getElementById('angle').value);
    drawCannon(currentAngle, cannonY); // Usa cannonY em pixels
}


// --- Lógica da Animação ---
function fire() {
    if (isAnimating) return;

    // --- Obter Entradas ---
    const v0_mps = Number(document.getElementById('velocity').value); // Velocidade inicial em m/s
    const angle_deg = Number(document.getElementById('angle').value); // Ângulo em graus
    const angle_rad = angle_deg * Math.PI / 180; // Ângulo em radianos

    // --- Calcular Posição Inicial e h0 (em METROS) ---
    // Posição inicial do projétil (boca do canhão) em PIXELS
    // Aproximação: considera o lançamento do centro da base por simplicidade.
    // Para maior precisão, calcularíamos a ponta do cano:
    // const barrelLengthPx = 40;
    // const startX_px = 50 + barrelLengthPx * Math.cos(angle_rad);
    // const startY_px = cannonY - barrelLengthPx * Math.sin(angle_rad);
    const startX_px = 50; // Posição X inicial em pixels
    const startY_px = cannonY; // Posição Y inicial em pixels

    // Altura inicial (h0) em METROS acima da superfície do chão (groundSurfaceY)
    // A altura em pixels é (groundSurfaceY - startY_px)
    // Convertendo para metros:
    const h0_meters = Math.max(0, (groundSurfaceY - startY_px) / pixelsPerMeter);

    // --- Calcular Componentes da Velocidade (m/s) ---
    const v0x_mps = v0_mps * Math.cos(angle_rad);
    const v0y_mps = v0_mps * Math.sin(angle_rad);

    // --- Cálculos Físicos (em METROS e SEGUNDOS) ---
    const maxHeight_meters = h0_meters + (v0y_mps * v0y_mps) / (2 * g);
    const totalTime_sec = (v0y_mps + Math.sqrt(v0y_mps * v0y_mps + 2 * g * h0_meters)) / g;
    const range_meters = v0x_mps * totalTime_sec;

    // --- Preparar Animação ---
    let t_sec = 0; // Tempo da simulação em segundos
    trajectory = [{ x: startX_px, y: startY_px }]; // Trajetória armazena pixels
    isAnimating = true;
    let currentProjectilePos_px = { x: startX_px, y: startY_px };

    function animate() {
        // 1. Redesenha a cena base (pixels)
        redrawScene();

        // 2. Calcula a nova posição em METROS relativa ao início
        const x_rel_m = v0x_mps * t_sec;
        const y_rel_m = v0y_mps * t_sec - 0.5 * g * t_sec * t_sec;

        // 3. Converte para posição absoluta em PIXELS no canvas
        const x_canvas_px = startX_px + x_rel_m; // Sem escala X por enquanto
        const y_canvas_px = startY_px - y_rel_m * pixelsPerMeter; // Converte y de metros para pixels e inverte

        // 4. Verifica colisão com o chão (pixels)
        if (y_canvas_px <= groundSurfaceY) {
            // Projétil no ar
            currentProjectilePos_px = { x: x_canvas_px, y: y_canvas_px };
            trajectory.push({ ...currentProjectilePos_px });

            // 5. Desenha trajetória e projétil (pixels)
            drawTrajectory();
            drawProjectile(currentProjectilePos_px.x, currentProjectilePos_px.y);

            // 6. Atualiza informações (valores em METROS)
            const currentHeight_meters = Math.max(0, (groundSurfaceY - y_canvas_px) / pixelsPerMeter);
            document.getElementById('info').innerHTML = `
                Altura Inicial: ${h0_meters.toFixed(2)}m<br>
                Altura Atual: ${currentHeight_meters.toFixed(2)}m<br>
                Altura Máxima: ${maxHeight_meters.toFixed(2)}m<br>
                Tempo Total Previsto: ${totalTime_sec.toFixed(2)}s<br>
                Alcance Previsto: ${range_meters.toFixed(2)}m
            `;

            // 7. Próximo passo
            t_sec += 0.02; // Incrementa tempo
            requestAnimationFrame(animate);
        } else {
            // Atingiu o chão
            isAnimating = false;

            // 8. Desenha estado final
            redrawScene();
            // Calcula posição final exata em pixels
            const finalX_px = startX_px + range_meters; // Usa range em metros (sem escala X)
            const finalY_px = groundSurfaceY;
            trajectory.push({ x: finalX_px, y: finalY_px }); // Adiciona ponto final à trajetória
            drawTrajectory();
            drawProjectile(finalX_px, finalY_px);

            // 9. Exibe informações finais (METROS)
            document.getElementById('info').innerHTML = `
                Altura Inicial: ${h0_meters.toFixed(2)}m<br>
                Altura Atual: 0.00m<br>
                Altura Máxima: ${maxHeight_meters.toFixed(2)}m<br>
                Tempo Total: ${totalTime_sec.toFixed(2)}s<br>
                Alcance: ${range_meters.toFixed(2)}m
            `;
        }
    }

    animate();
}

// --- Event Listeners para Arrastar o Canhão (usam PIXELS) ---
canvas.addEventListener('mousedown', (e) => {
    if (isAnimating) return;
    const mousePos = getMousePos(canvas, e);
    // Hitbox da base do canhão (pixels)
    if (mousePos.x >= 50 - cannonBaseRadius && mousePos.x <= 50 + cannonBaseRadius &&
        mousePos.y >= cannonY - cannonBaseRadius && mousePos.y <= cannonY + cannonBaseRadius) {
        isDragging = true;
        dragOffsetY = mousePos.y - cannonY;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const mousePos = getMousePos(canvas, e);
        let newY = mousePos.y - dragOffsetY; // Nova posição Y do centro em pixels

        // Limita Y (pixels): mínimo é cannonMinY, máximo é um pouco abaixo do topo (ex: 10px)
        newY = Math.max(10, Math.min(cannonMinY, newY));

        cannonY = newY; // Atualiza posição Y em pixels
        redrawScene(); // Redesenha com a nova posição em pixels
    }
});

canvas.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'default';
    }
});


// --- Handlers para Atualizar os Sliders ---
document.getElementById('velocity').oninput = function() {
    document.getElementById('velocityValue').textContent = this.value;
}
document.getElementById('angle').oninput = function() {
    document.getElementById('angleValue').textContent = this.value;
    if (!isAnimating) {
        redrawScene(); // Redesenha canhão no novo ângulo (posição Y em pixels não muda)
    }
}

// --- Desenho Inicial ---
redrawScene(); // Desenha a cena inicial com canhão na posição Y inicial (pixels)