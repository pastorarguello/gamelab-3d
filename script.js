<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Juego 3D: Supervivencia Neón</title>
    <script src="https://code.playcanvas.com/playcanvas-stable.min.js"></script>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background-color: #000; }
        canvas { display: block; width: 100vw; height: 100vh; }
        #interfaz {
            position: absolute;
            top: 20px;
            left: 20px;
            color: white;
            font-family: system-ui, sans-serif;
            background: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 8px;
            border: 2px solid #56f5d2;
            box-shadow: 0 0 15px #56f5d244;
        }
        #tiempo { color: #56f5d2; font-size: 24px; font-weight: bold; }
        #mensajeOver {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: system-ui, sans-serif;
            font-size: 32px;
            font-weight: bold;
            color: #ff4757;
            background: rgba(0, 0, 0, 0.9);
            padding: 30px;
            border-radius: 10px;
            border: 3px solid #ff4757;
            display: none;
            text-align: center;
            cursor: pointer;
        }
    </style>
</head>
<body>

    <div id="interfaz">
        Tiempo Sobrevivido: <span id="tiempo">0</span>s<br>
        <span style="font-size: 14px; color: #a2aec9;">Usa Flechas o WASD para esquivar los cubos</span>
    </div>

    <div id="mensajeOver" onclick="location.reload()">
        ¡TE ATRAPARON!<br>
        <span style="font-size:16px; color:#fff;">Haz clic para reiniciar</span>
    </div>

    <canvas id="mundo3D"></canvas>

    <script>
        const canvas = document.getElementById('mundo3D');
        const spanTiempo = document.getElementById('tiempo');
        const divMensaje = document.getElementById('mensajeOver');
        
        const app = new pc.Application(canvas, { keyboard: new pc.Keyboard(window) });
        app.start();
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);
        window.addEventListener('resize', () => app.resizeCanvas());

        // 1. ESCENARIO (La Arena)
        const camara = new pc.Entity();
        camara.addComponent('camera', { clearColor: new pc.Color(0.05, 0.05, 0.08) });
        camara.setPosition(0, 18, 12); // Cámara desde arriba e inclinada
        camara.lookAt(0, 0, 0);
        app.root.addChild(camara);

        const luz = new pc.Entity();
        luz.addComponent('light', { type: 'directional', color: new pc.Color(1, 1, 1), intensity: 1.2 });
        luz.setEulerAngles(45, 30, 0);
        app.root.addChild(luz);

        // Suelo de la arena (20x20)
        const matSuelo = new pc.StandardMaterial();
        matSuelo.diffuse.set(0.1, 0.1, 0.2);
        matSuelo.update();

        const suelo = new pc.Entity();
        suelo.addComponent('render', { type: 'plane' });
        suelo.setLocalScale(20, 1, 20);
        suelo.render.material = matSuelo;
        app.root.addChild(suelo);

        // Paredes para delimitar
        const matPared = new pc.StandardMaterial();
        matPared.diffuse.set(0.3, 0.2, 0.8);
        matPared.emissive.set(0.1, 0.05, 0.3);
        matPared.update();

        function crearPared(x, z, sx, sz) {
            const pared = new pc.Entity();
            pared.addComponent('render', { type: 'box' });
            pared.setLocalScale(sx, 1, sz);
            pared.setPosition(x, 0.5, z);
            pared.render.material = matPared;
            app.root.addChild(pared);
        }
        crearPared(0, 10.5, 22, 1);   // Arriba
        crearPared(0, -10.5, 22, 1);  // Abajo
        crearPared(10.5, 0, 1, 20);   // Derecha
        crearPared(-10.5, 0, 1, 20);  // Izquierda

        // 2. JUGADOR
        const matJugador = new pc.StandardMaterial();
        matJugador.diffuse.set(0.2, 1, 0.8); // Cian brillante
        matJugador.update();

        const jugador = new pc.Entity();
        jugador.addComponent('render', { type: 'sphere' });
        jugador.setPosition(0, 0.5, 0);
        jugador.render.material = matJugador;
        app.root.addChild(jugador);

        // 3. ENEMIGOS (Cubos rojos rebotando)
        const matEnemigo = new pc.StandardMaterial();
        matEnemigo.diffuse.set(1, 0.2, 0.3); // Rojo Neón
        matEnemigo.emissive.set(0.5, 0.1, 0.1);
        matEnemigo.update();

        const enemigos = [];
        
        function crearEnemigo() {
            const enemigo = new pc.Entity();
            enemigo.addComponent('render', { type: 'box' });
            
            // Aparecen en las esquinas para no matar al jugador instantáneamente
            let esquinaX = (Math.random() > 0.5 ? 1 : -1) * 9;
            let esquinaZ = (Math.random() > 0.5 ? 1 : -1) * 9;
            enemigo.setPosition(esquinaX, 0.5, esquinaZ);
            
            enemigo.render.material = matEnemigo;
            app.root.addChild(enemigo);

            // Asignarle velocidad aleatoria propia
            let velX = (Math.random() * 4 + 4) * (Math.random() > 0.5 ? 1 : -1);
            let velZ = (Math.random() * 4 + 4) * (Math.random() > 0.5 ? 1 : -1);

            enemigos.push({ entidad: enemigo, vx: velX, vz: velZ });
        }

        // 4. VARIABLES GLOBALES
        let juegoActivo = true;
        let tiempoSobrevivido = 0;
        let temporizadorEnemigos = 0;

        // Crear primer enemigo
        crearEnemigo();

        // 5. BUCLE PRINCIPAL
        app.on('update', function (dt) {
            if (!juegoActivo) return;

            // --- CRONÓMETRO ---
            tiempoSobrevivido += dt;
            spanTiempo.textContent = Math.floor(tiempoSobrevivido);

            // Cada 4 segundos, aparece un nuevo cubo rojo (Aumenta la dificultad)
            temporizadorEnemigos += dt;
            if (temporizadorEnemigos >= 4) {
                crearEnemigo();
                temporizadorEnemigos = 0;
            }

            // --- MOVIMIENTO DEL JUGADOR ---
            let velocidadJugador = 10 * dt;
            let posJ = jugador.getPosition();
            let movX = 0;
            let movZ = 0;

            if ((app.keyboard.isPressed(pc.KEY_LEFT) || app.keyboard.isPressed(pc.KEY_A))) movX -= velocidadJugador;
            if ((app.keyboard.isPressed(pc.KEY_RIGHT) || app.keyboard.isPressed(pc.KEY_D))) movX += velocidadJugador;
            if ((app.keyboard.isPressed(pc.KEY_UP) || app.keyboard.isPressed(pc.KEY_W))) movZ -= velocidadJugador;
            if ((app.keyboard.isPressed(pc.KEY_DOWN) || app.keyboard.isPressed(pc.KEY_S))) movZ += velocidadJugador;

            // Mover al jugador y limitar su posición a la arena (Limitar entre -9.5 y 9.5)
            let nuevaX = Math.max(-9.5, Math.min(9.5, posJ.x + movX));
            let nuevaZ = Math.max(-9.5, Math.min(9.5, posJ.z + movZ));
            jugador.setPosition(nuevaX, posJ.y, nuevaZ);
            
            // Actualizar posJ para la detección de colisiones
            posJ = jugador.getPosition(); 

            // --- FÍSICAS DE LOS ENEMIGOS ---
            for (let i = 0; i < enemigos.length; i++) {
                let e = enemigos[i];
                let posE = e.entidad.getPosition();

                // Mover al enemigo basado en su velocidad
                let nx = posE.x + (e.vx * dt);
                let nz = posE.z + (e.vz * dt);

                // Rebotar en las paredes
                if (nx > 9.5 || nx < -9.5) {
                    e.vx *= -1; // Invertir dirección X
                    nx = Math.max(-9.5, Math.min(9.5, nx));
                }
                if (nz > 9.5 || nz < -9.5) {
                    e.vz *= -1; // Invertir dirección Z
                    nz = Math.max(-9.5, Math.min(9.5, nz));
                }

                e.entidad.setPosition(nx, 0.5, nz);

                // Colisión con el Jugador (Distancia Euclidiana)
                let dx = posJ.x - nx;
                let dz = posJ.z - nz;
                let distancia = Math.sqrt(dx * dx + dz * dz);

                if (distancia < 1.0) { // Radio del jugador (0.5) + Radio del enemigo (0.5)
                    juegoActivo = false;
                    divMensaje.style.display = 'block';
                }
            }
        });
    </script>
</body>
</html>