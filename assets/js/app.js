document.addEventListener('DOMContentLoaded', () => {
    // === Intro: conversación estilo WhatsApp antes de la pantalla principal ===
    (function initIntroChat() {
        const overlay = document.getElementById('intro-chat');
        const body = document.getElementById('intro-chat-body');
        const skipBtn = document.getElementById('intro-skip');
        const startScreen = document.getElementById('screen-start');
        if (!overlay || !body || !startScreen) return;

        document.body.classList.add('intro-running');

        const messages = [
            { side: 'in',  text: 'eyy tío ya sabes que vas a votar?' },
            { side: 'out', text: 'que va creo que no voy a las urnas...' },
            { side: 'out', text: 'soy apolítico', typingSeq: [1800, 1000, 1800] },
            { side: 'in',  text: 'tío necesitas hacer click' }
        ];

        let finished = false;
        const timers = [];
        const wait = (ms) => new Promise(res => timers.push(setTimeout(res, ms)));

        function escapeHtml(s) {
            return s.replace(/[&<>"']/g, c => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
            ));
        }

        function clockLabel() {
            const d = new Date();
            return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
        }

        function addTyping(side) {
            const el = document.createElement('div');
            el.className = `intro-msg intro-msg--${side} intro-typing`;
            el.innerHTML = '<span class="intro-bubble"><span class="intro-dots"><i></i><i></i><i></i></span></span>';
            body.appendChild(el);
            return el;
        }

        function addMessage(side, text) {
            const el = document.createElement('div');
            el.className = `intro-msg intro-msg--${side}`;
            const ticks = side === 'out' ? '<span class="intro-ticks">✓✓</span>' : '';
            el.innerHTML = `<span class="intro-bubble">${escapeHtml(text)}` +
                `<span class="intro-meta">${clockLabel()}${ticks}</span></span>`;
            body.appendChild(el);
            return el;
        }

        function finishIntro() {
            if (finished) return;
            finished = true;
            timers.forEach(clearTimeout);
            overlay.classList.add('intro-chat--leaving');
            // Revelar y reproducir la animación de entrada (lenta) de la pantalla principal
            document.body.classList.remove('intro-running');
            startScreen.classList.remove('entering', 'intro-entering');
            void startScreen.offsetWidth;
            startScreen.classList.add('intro-entering');
            setTimeout(() => { overlay.remove(); }, 520);
            setTimeout(() => { startScreen.classList.remove('intro-entering'); }, 1900);
        }

        async function run() {
            await wait(650);
            for (const msg of messages) {
                if (finished) return;
                // Secuencia de "escribiendo…": alterna mostrar (par) y ocultar (impar)
                const seq = msg.typingSeq || [Math.min(1700, 550 + msg.text.length * 32)];
                for (let i = 0; i < seq.length; i++) {
                    if (i % 2 === 0) {
                        const typing = addTyping(msg.side);
                        await wait(seq[i]);
                        typing.remove();
                    } else {
                        await wait(seq[i]);
                    }
                    if (finished) return;
                }
                addMessage(msg.side, msg.text);   // los mensajes se acumulan
                await wait(750);
            }
            await wait(2400);                      // se mantiene la conversación (+1 s tras el último mensaje)
            finishIntro();                         // y desaparece toda al terminar
        }

        skipBtn.addEventListener('click', finishIntro);
        // El botón de saltar solo está disponible durante 4 s
        timers.push(setTimeout(() => { skipBtn.classList.add('intro-skip--gone'); }, 4000));
        run();
    })();

    // === Tiempos del juego (ajustar aquí para pruebas) ===
    const TIMINGS = {
        PLAYER_TURN_SEC:     40,     // segundos por turno de cada jugador
        TURN_READ_MS:        5000,   // pausa (ms) en la que solo se ve la consigna antes de arrancar el turno
        REVEAL_VIEW_MS:      5000,   // pausa (ms) para ver el reverso de las cartas tras la decisión
        DECISION_SEC:        120,    // segundos de deliberación común tras los 4 turnos
        BETWEEN_ROUNDS_MS:   10000,  // pausa (ms) entre revelar efectos e iniciar la siguiente ronda
        DECISION_LABEL:      '2 min' // texto del cartel "Decisión común" (solo visual)
    };

    const screens = {
        start: document.getElementById('screen-start'),
        rules: document.getElementById('screen-rules'),
        game: document.getElementById('screen-game'),
        end: document.getElementById('screen-end')
    };

    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    let gameSessionId = 0;
    function stale(s) { return s !== gameSessionId; }

    document.getElementById('btn-new-game').addEventListener('click', (e) => {
        // La partida solo está disponible en pantallas anchas (apaisadas, tipo ordenador).
        if (window.matchMedia('(max-width: 1024px), (orientation: portrait), (max-aspect-ratio: 13/10)').matches) return;
        startGame(e.currentTarget.getBoundingClientRect());
    });

    let lastRulesButtonRect = null;

    document.getElementById('btn-rules').addEventListener('click', (e) => {
        lastRulesButtonRect = e.currentTarget.getBoundingClientRect();
        emergeRulesFromButton(lastRulesButtonRect);
    });

    // === Ajustes: tiempo de turno por jugador ===
    (function initSettings() {
        const TURN_MIN = 5, TURN_MAX = 120, TURN_STEP = 5, TURN_DEFAULT = 40, STORAGE_KEY = 'turnTimeSec';
        const overlay = document.getElementById('settings-overlay');
        const openBtn = document.getElementById('btn-settings');
        const closeBtn = document.getElementById('btn-close-settings');
        const saveBtn = document.getElementById('btn-save-settings');
        const minusBtn = document.getElementById('turn-time-minus');
        const plusBtn = document.getElementById('turn-time-plus');
        const valueEl = document.getElementById('turn-time-value');
        if (!overlay || !openBtn) return;

        // Cargar valor guardado (si existe y es válido); si no, 40 por defecto
        const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
        TIMINGS.PLAYER_TURN_SEC =
            (!isNaN(saved) && saved >= TURN_MIN && saved <= TURN_MAX) ? saved : TURN_DEFAULT;

        // Valor en edición: no se aplica ni se guarda hasta pulsar "Guardar"
        let draft = TIMINGS.PLAYER_TURN_SEC;

        function render() {
            valueEl.textContent = `${draft} s`;
            minusBtn.disabled = draft <= TURN_MIN;
            plusBtn.disabled = draft >= TURN_MAX;
            if (saveBtn) saveBtn.disabled = draft === TIMINGS.PLAYER_TURN_SEC;
        }
        function setDraft(sec) {
            draft = Math.max(TURN_MIN, Math.min(TURN_MAX, sec));
            render();
        }
        function saveSettings() {
            TIMINGS.PLAYER_TURN_SEC = draft;
            localStorage.setItem(STORAGE_KEY, String(draft));
            render();
            closeSettings();
        }
        // Al abrir/cerrar sin guardar, el borrador vuelve al valor aplicado
        function openSettings() { draft = TIMINGS.PLAYER_TURN_SEC; render(); overlay.classList.add('visible'); }
        function closeSettings() { overlay.classList.remove('visible'); draft = TIMINGS.PLAYER_TURN_SEC; render(); }

        openBtn.addEventListener('click', openSettings);
        closeBtn.addEventListener('click', closeSettings);
        if (saveBtn) saveBtn.addEventListener('click', saveSettings);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
        minusBtn.addEventListener('click', () => setDraft(draft - TURN_STEP));
        plusBtn.addEventListener('click', () => setDraft(draft + TURN_STEP));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('visible')) closeSettings();
        });

        render();
    })();

    function emergeRulesFromButton(btnRect) {
        const btnCx = btnRect.left + btnRect.width / 2;
        const btnCy = btnRect.top + btnRect.height / 2;

        // Inicio: marcar para animación de salida sin ocultar todavía
        screens.start.classList.add('leaving');
        Object.values(screens).forEach(s => { if (s !== screens.start) s.classList.remove('active'); });
        screens.rules.classList.add('active', 'entering');
        goToRuleCard(0);

        requestAnimationFrame(() => {
            const deck = document.querySelector('.rules-deck');
            if (!deck) {
                requestAnimationFrame(() => requestAnimationFrame(updateScrollIndicator));
                return;
            }
            const deckRect = deck.getBoundingClientRect();
            const dx = btnCx - (deckRect.left + deckRect.width / 2);
            const dy = btnCy - (deckRect.top + deckRect.height / 2);

            ruleCards.forEach((card, i) => {
                card.style.transition = 'none';
                card.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.06) rotate(${(i - currentRuleIndex) * 4}deg)`;
                card.style.opacity = '0';
            });

            deck.getBoundingClientRect();

            requestAnimationFrame(() => {
                ruleCards.forEach(card => {
                    card.style.transition = '';
                    card.style.transform = '';
                    card.style.opacity = '';
                });
                requestAnimationFrame(() => requestAnimationFrame(updateScrollIndicator));
            });
        });

        // Tras completarse la animación de salida, ocultar inicio limpiamente
        setTimeout(() => {
            screens.start.classList.remove('active', 'leaving');
            screens.rules.classList.remove('entering');
        }, 650);
    }

    function collapseRulesToButton() {
        const deck = document.querySelector('.rules-deck');
        if (!lastRulesButtonRect || !deck) {
            showScreen('start');
            return;
        }
        const btnCx = lastRulesButtonRect.left + lastRulesButtonRect.width / 2;
        const btnCy = lastRulesButtonRect.top + lastRulesButtonRect.height / 2;
        const deckRect = deck.getBoundingClientRect();
        const dx = btnCx - (deckRect.left + deckRect.width / 2);
        const dy = btnCy - (deckRect.top + deckRect.height / 2);

        // Cartas: colapsan hacia el botón
        ruleCards.forEach((card, i) => {
            card.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.06) rotate(${(i - currentRuleIndex) * 4}deg)`;
            card.style.opacity = '0';
        });

        // En paralelo: controles de reglas salen, pantalla de inicio reaparece
        screens.rules.classList.add('leaving');
        screens.start.classList.add('active', 'entering');

        // Cuando termina el colapso, ocultar reglas y limpiar
        setTimeout(() => {
            ruleCards.forEach(card => {
                card.style.transition = 'none';
                card.style.transform = '';
                card.style.opacity = '';
            });
            screens.rules.classList.remove('active', 'leaving');
            requestAnimationFrame(() => {
                ruleCards.forEach(card => { card.style.transition = ''; });
            });
        }, 600);

        // Quitar .entering tras completarse su animación
        setTimeout(() => {
            screens.start.classList.remove('entering');
        }, 700);
    }

    document.getElementById('btn-close-rules').addEventListener('click', () => {
        collapseRulesToButton();
    });

    document.getElementById('screen-rules').addEventListener('click', (e) => {
        // Solo cerrar al tocar el fondo real: cualquier toque dentro del escenario
        // (cartas, peeks laterales, navegación) navega o no hace nada, nunca cierra.
        // Evita que un toque fallido al pasar de carta en móvil salga de las reglas.
        if (e.target.closest('.rules-stage, .rules-nav, .btn-close')) return;
        collapseRulesToButton();
    });

    // ===== Navegación del mazo de reglas =====
    const ruleCards = Array.from(document.querySelectorAll('.rules-card'));
    const rulesTotalEl = document.getElementById('rules-total');
    const rulesCurrentEl = document.getElementById('rules-current');
    const btnPrevRule = document.getElementById('btn-prev-rule');
    const btnNextRule = document.getElementById('btn-next-rule');
    let currentRuleIndex = 0;

    if (rulesTotalEl) rulesTotalEl.textContent = ruleCards.length;

    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'rules-scroll-down';
    scrollBtn.setAttribute('aria-label', 'Desplazar hacia abajo');
    scrollBtn.innerHTML = '↓';
    const rulesDeckEl = document.querySelector('.rules-deck');
    if (rulesDeckEl) rulesDeckEl.appendChild(scrollBtn);

    function updateScrollIndicator() {
        const card = ruleCards[currentRuleIndex];
        if (!card) { scrollBtn.classList.remove('visible'); return; }
        const overflows = card.scrollHeight > card.clientHeight + 4;
        const atBottom = card.scrollTop + card.clientHeight >= card.scrollHeight - 4;
        scrollBtn.classList.toggle('visible', overflows && !atBottom);
    }

    scrollBtn.addEventListener('click', () => {
        const card = ruleCards[currentRuleIndex];
        if (!card) return;
        card.scrollBy({ top: card.clientHeight * 0.75, behavior: 'smooth' });
    });

    ruleCards.forEach(card => card.addEventListener('scroll', updateScrollIndicator));
    window.addEventListener('resize', updateScrollIndicator);

    function goToRuleCard(targetIndex) {
        if (targetIndex < 0 || targetIndex >= ruleCards.length) return;
        currentRuleIndex = targetIndex;

        ruleCards.forEach((card, i) => {
            card.classList.remove('active', 'prev', 'next', 'far-prev', 'far-next');
            const offset = i - targetIndex;
            if (offset === 0) card.classList.add('active');
            else if (offset === -1) card.classList.add('prev');
            else if (offset === 1) card.classList.add('next');
            else if (offset < -1) card.classList.add('far-prev');
            else card.classList.add('far-next');
        });
        const newActive = ruleCards[targetIndex];
        if (newActive) newActive.scrollTop = 0;
        updateRulesNav();
        requestAnimationFrame(updateScrollIndicator);
    }

    function updateRulesNav() {
        if (rulesCurrentEl) rulesCurrentEl.textContent = currentRuleIndex + 1;
        if (btnPrevRule) btnPrevRule.disabled = currentRuleIndex === 0;
        if (btnNextRule) btnNextRule.disabled = currentRuleIndex === ruleCards.length - 1;
    }

    if (btnPrevRule) btnPrevRule.addEventListener('click', () => goToRuleCard(currentRuleIndex - 1));
    if (btnNextRule) btnNextRule.addEventListener('click', () => goToRuleCard(currentRuleIndex + 1));

    ruleCards.forEach((card, i) => {
        card.addEventListener('click', () => {
            if (card.classList.contains('prev')) goToRuleCard(currentRuleIndex - 1);
            else if (card.classList.contains('next')) goToRuleCard(currentRuleIndex + 1);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (!screens.rules.classList.contains('active')) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); goToRuleCard(currentRuleIndex + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); goToRuleCard(currentRuleIndex - 1); }
        else if (e.key === 'Escape') { e.preventDefault(); collapseRulesToButton(); }
    });

    updateRulesNav();

    document.getElementById('btn-restart').addEventListener('click', () => {
        showScreen('start');
    });

    let exiting = false;

    async function exitToMainMenu() {
        if (exiting) return;
        exiting = true;

        gameSessionId++;

        clearInterval(timerInterval);
        if (decisionTimerResolve) {
            decisionTimerResolve('aborted');
            decisionTimerResolve = null;
        }

        turnPhaseActive = false;
        revealingEffects = false;
        selectedDecision = null;
        currentHand = null;

        ['role-info-overlay', 'action-info-overlay', 'turn-overlay', 'round-summary-overlay'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('visible', 'dealt', 'reading');
        });
        screens.game.classList.remove('reading-mode');

        const startBtn = document.getElementById('btn-start-reading');
        if (startBtn) { startBtn.style.display = 'none'; startBtn.textContent = 'START'; }
        const consignaEl = document.querySelector('#turn-overlay .turn-consigna');
        if (consignaEl) { consignaEl.textContent = ''; consignaEl.classList.remove('is-leaving'); }
        const turnCard = document.querySelector('#turn-overlay .turn-card');
        if (turnCard) turnCard.classList.remove('consigna-only', 'info-entering');
        const dashTimer = document.getElementById('timer');
        if (dashTimer) dashTimer.classList.remove('counting');
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('selected'));

        const exitBtn = document.getElementById('btn-exit-game');
        const exitRect = exitBtn ? exitBtn.getBoundingClientRect() : null;
        const dealOverlay = document.getElementById('role-deal-overlay');
        const dealVisible = !!(dealOverlay && dealOverlay.classList.contains('visible'));

        if (exitRect && screens.game.classList.contains('active')) {
            screens.start.classList.add('active', 'entering');

            const collapses = [collapseGameToButton(exitRect)];
            if (dealVisible) collapses.push(collapseDealCardsToButton(exitRect));
            await Promise.all(collapses);

            screens.game.classList.remove('active');
            screens.start.classList.remove('entering');
        } else {
            showScreen('start');
        }

        screens.game.classList.remove('emerging');
        if (dealOverlay) dealOverlay.classList.remove('visible', 'dealt');

        document.querySelectorAll('#screen-game .player-corner, #screen-game .dashboard, #btn-exit-game, .deal-card').forEach(el => {
            el.style.transition = '';
            el.style.transform = '';
            el.style.opacity = '';
        });

        exiting = false;
    }

    function collapseGameToButton(btnRect) {
        return new Promise(resolve => {
            const btnCx = btnRect.left + btnRect.width / 2;
            const btnCy = btnRect.top + btnRect.height / 2;
            const elements = [
                ...document.querySelectorAll('#screen-game .player-corner'),
                document.querySelector('#screen-game .dashboard'),
                document.getElementById('btn-exit-game')
            ].filter(Boolean);
            if (!elements.length) { resolve(); return; }

            screens.game.classList.add('emerging');

            const mid = (elements.length - 1) / 2;

            elements.forEach((el, i) => {
                const rect = el.getBoundingClientRect();
                const dx = btnCx - (rect.left + rect.width / 2);
                const dy = btnCy - (rect.top + rect.height / 2);
                const rot = (i - mid) * 10;
                const delay = i * EMERGE_STAGGER_MS;
                el.style.transition =
                    `transform ${EMERGE_DURATION_MS}ms ${EMERGE_EASE} ${delay}ms, ` +
                    `opacity ${EMERGE_OPACITY_MS}ms ${EMERGE_EASE} ${delay}ms`;
                el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${EMERGE_INITIAL_SCALE}) rotate(${rot}deg)`;
                el.style.opacity = '0';
            });

            const total = EMERGE_DURATION_MS + (elements.length - 1) * EMERGE_STAGGER_MS + 60;
            setTimeout(resolve, total);
        });
    }

    function collapseDealCardsToButton(btnRect) {
        return new Promise(resolve => {
            const dealCards = Array.from(document.querySelectorAll('.deal-card'));
            const overlay = document.getElementById('role-deal-overlay');
            if (!dealCards.length || !overlay) { resolve(); return; }
            const btnCx = btnRect.left + btnRect.width / 2;
            const btnCy = btnRect.top + btnRect.height / 2;
            const overlayRect = overlay.getBoundingClientRect();
            const dx = btnCx - (overlayRect.left + overlayRect.width / 2);
            const dy = btnCy - (overlayRect.top + overlayRect.height / 2);

            dealCards.forEach((card, i) => {
                const delay = i * DEAL_STAGGER_MS;
                const naturalRot = DEAL_NATURAL_ROTATIONS[i] || 0;
                const rot = naturalRot - DEAL_SPIN_DEG;
                card.style.transition =
                    `transform ${DEAL_DURATION_MS}ms ${DEAL_EASE} ${delay}ms, ` +
                    `opacity ${DEAL_OPACITY_MS}ms ease-in ${delay + DEAL_DURATION_MS - DEAL_OPACITY_MS}ms`;
                card.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${DEAL_INITIAL_SCALE}) rotate(${rot}deg)`;
                card.style.opacity = '0';
            });

            overlay.classList.remove('visible');

            const total = DEAL_DURATION_MS + (dealCards.length - 1) * DEAL_STAGGER_MS + 80;
            setTimeout(resolve, total);
        });
    }

    document.getElementById('btn-exit-game').addEventListener('click', exitToMainMenu);

    const MAX_INDICATOR = 8;

    const ROLES = [
        { name: 'Roro La Carnicera', indicator: 'pluralismo', label: 'Pluralismo',
          image: 'assets/img/roro.webp',
          description: 'Treinta años detrás del mostrador. Le entran clientes de todos los colores y de todos los humores, y todos tienen que seguir entrando mañana. Quiere que en el barrio sigan cabiendo todos, su indicador es <span class="kw-pluralismo">Pluralismo</span>.' },
        { name: 'Lola Líos La Presidenta', indicator: 'participacion', label: 'Participación',
          image: 'assets/img/lola.webp',
          description: 'Agenda partida en bloques de quince minutos y la certeza de que cualquier decisión saldrá mal en algún titular. Su empeño: que las reglas se cumplan y las cosas mejoren paso a paso, su indicador es <span class="kw-participacion">Participación</span>.' },
        { name: 'Belén La Redactora', indicator: 'informacion', label: 'Información',
          image: 'assets/img/belen.webp',
          description: 'Poco presupuesto, mucho trabajo. Pelea a diario contra bulos, fuentes interesadas y la tentación del titular fácil. Quiere proteger la labor periodística, su indicador es <span class="kw-info">Información</span>.' },
        { name: 'Florentino El Empresario', indicator: 'confianza', label: 'Confianza',
          image: 'assets/img/florentino.webp',
          description: 'Empresa heredada, doce empleados, nóminas que pagar el día 30. Sin reglas estables, se le caen los planes a tres meses vista. Quiere que las reglas no cambien con el viento, su indicador es <span class="kw-confianza">Confianza</span>.' }
    ];

    // Precargar los retratos de los roles para que estén en caché antes de mostrarse
    ROLES.forEach(role => { const img = new Image(); img.src = role.image; });

    let playerRoles = [];

    // Consignas de comunicación afectiva y efectiva que aparecen en cada turno.
    const COMM_CONSIGNAS = [
        'Habla en primera persona: "yo creo", no "tú siempre".',
        'Antes de opinar, resume lo que dijo el anterior.',
        'Defiende tu indicador sin descalificar otros roles.',
        'Pregunta antes de afirmar: ¿por qué le importa al otro?',
        'Escucha para entender, no para responder.',
        'Reconoce algo válido en la postura contraria.',
        'Habla del problema, no de la persona.',
        'Propón, no impongas: busca una salida que sume.',
        'Baja el volumen: la calma convence más que gritar.',
        'Sé concreto: un ejemplo real, no una acusación.',
        'Nombra lo que sientes: "me frustra", no "tú me frustras".',
        'Pide aclaración antes de juzgar: "¿quieres decir que…?".',
        'Cede en lo pequeño para avanzar en lo importante.',
        'Valida la emoción del otro aunque no compartas su idea.',
        'Cuida lo no verbal: mira a quien habla y no interrumpas.',
        'Busca el interés común, no solo quién gana.',
        'Haz una pregunta antes de defender tu postura.',
        'Di "sí, y…" en vez de "sí, pero…".',
        'Pon límites sin levantar la voz.',
        'Acepta que puedes estar equivocado en algo.',
        'Resume el acuerdo antes de seguir discutiendo.',
        'Da tiempo a quien habla: no llenes cada silencio.',
        'Critica la idea, nunca la intención del otro.',
        'Pregunta "¿qué propones tú?" en vez de bloquear.',
        'Reconoce el esfuerzo del otro, no solo el error.',
        'Habla de datos, no de rumores ni suposiciones.',
        'Cede el turno a quien aún no ha hablado.',
        'Separa el problema de hoy de los rencores de ayer.',
        'Repite con tus palabras lo que entendiste del otro.',
        'Ofrece una alternativa, no solo un "no".',
        'Agradece una idea buena aunque no sea la tuya.'
    ];

    function pickConsignas(n) {
        const shuffled = [...COMM_CONSIGNAS].sort(() => Math.random() - 0.5);
        return Array.from({ length: n }, (_, i) => shuffled[i % shuffled.length]);
    }

    function setRolePortrait(portraitEl, imgEl, role) {
        if (!portraitEl || !imgEl) return;
        if (role.image) {
            imgEl.src = role.image;
            imgEl.alt = role.name;
            imgEl.style.display = '';
            portraitEl.classList.remove('placeholder');
            portraitEl.removeAttribute('data-initial');
        } else {
            imgEl.removeAttribute('src');
            imgEl.alt = '';
            imgEl.style.display = 'none';
            portraitEl.classList.add('placeholder');
            portraitEl.dataset.initial = role.name.charAt(0);
        }
    }

    function assignRoles() {
        const shuffled = [...ROLES].sort(() => Math.random() - 0.5);
        playerRoles = shuffled;
        for (let i = 0; i < 4; i++) {
            const role = shuffled[i];
            const slot = document.getElementById(`player-${i + 1}`);
            slot.classList.toggle('president', role.indicator === 'participacion');
            slot.querySelector('.role-name').textContent = role.name;
            slot.querySelector('.indicator-name').textContent = role.label;
            slot.querySelector('.bar').dataset.indicator = role.indicator;
            setRolePortrait(
                slot.querySelector('.player-portrait'),
                slot.querySelector('.player-portrait-img'),
                role
            );

            const dealCard = document.querySelector(`.deal-card[data-player="${i + 1}"]`);
            if (dealCard) {
                dealCard.querySelector('.deal-role').textContent = role.name;
                dealCard.querySelector('.deal-desc').innerHTML = role.description;
                setRolePortrait(
                    dealCard.querySelector('.deal-role-portrait'),
                    dealCard.querySelector('.deal-role-img'),
                    role
                );
            }
        }
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function dealRolesShowAndEmerge(originRect = null, extraEmerge = null) {
        const overlay = document.getElementById('role-deal-overlay');
        overlay.classList.remove('dealt');
        overlay.classList.add('visible');
        const promises = [];
        if (originRect) promises.push(emergeDealCardsFromButton(originRect));
        if (extraEmerge) promises.push(extraEmerge);
        if (promises.length) await Promise.all(promises);
    }

    const DEAL_TO_PLAYER_DUR_MS     = 700;
    const DEAL_TO_PLAYER_STAGGER_MS = 78;
    const DEAL_TO_PLAYER_POS_EASE   = 'cubic-bezier(0.45, 0, 0.15, 1)';   // arranque rápido
    const DEAL_TO_PLAYER_SPIN_EASE  = 'cubic-bezier(0.34, 1.5, 0.5, 1)';  // aterrizaje con rebote
    const DEAL_TO_PLAYER_ORDER      = [0, 3, 1, 2];                        // reparto en cruz

    async function dealRolesWaitAndHide() {
        const mySession = gameSessionId;
        const overlay = document.getElementById('role-deal-overlay');
        await waitForClick(overlay);
        if (stale(mySession)) return;

        const dealCards = Array.from(document.querySelectorAll('.deal-card'));
        DEAL_TO_PLAYER_ORDER.forEach((cardIdx, dealIdx) => {
            const card = dealCards[cardIdx];
            if (!card) return;
            const delay = dealIdx * DEAL_TO_PLAYER_STAGGER_MS;
            card.style.transition =
                `top ${DEAL_TO_PLAYER_DUR_MS}ms ${DEAL_TO_PLAYER_POS_EASE} ${delay}ms, ` +
                `left ${DEAL_TO_PLAYER_DUR_MS}ms ${DEAL_TO_PLAYER_POS_EASE} ${delay}ms, ` +
                `right ${DEAL_TO_PLAYER_DUR_MS}ms ${DEAL_TO_PLAYER_POS_EASE} ${delay}ms, ` +
                `bottom ${DEAL_TO_PLAYER_DUR_MS}ms ${DEAL_TO_PLAYER_POS_EASE} ${delay}ms, ` +
                `transform ${DEAL_TO_PLAYER_DUR_MS}ms ${DEAL_TO_PLAYER_SPIN_EASE} ${delay}ms, ` +
                `box-shadow ${DEAL_TO_PLAYER_DUR_MS}ms ease ${delay}ms`;
        });

        overlay.classList.add('dealt');

        const total = DEAL_TO_PLAYER_DUR_MS + (DEAL_TO_PLAYER_ORDER.length - 1) * DEAL_TO_PLAYER_STAGGER_MS + 120;
        await wait(total);
        if (stale(mySession)) return;

        dealCards.forEach(card => { card.style.transition = ''; });

        overlay.classList.remove('visible');
        overlay.classList.remove('dealt');
    }

    async function dealRoles(originRect = null) {
        const mySession = gameSessionId;
        await dealRolesShowAndEmerge(originRect);
        if (stale(mySession)) return;
        await dealRolesWaitAndHide();
    }

    const EMERGE_DURATION_MS    = 900;
    const EMERGE_STAGGER_MS     = 70;
    const EMERGE_OPACITY_MS     = 550;
    const EMERGE_EASE           = 'cubic-bezier(0.18, 0.85, 0.42, 1)';
    const EMERGE_INITIAL_SCALE  = 0.04;

    // Dealing-card animation: longer stagger, full-size flight, spin while travelling, overshoot landing.
    const DEAL_DURATION_MS      = 620;
    const DEAL_STAGGER_MS       = 200;
    const DEAL_OPACITY_MS       = 180;
    const DEAL_EASE             = 'cubic-bezier(0.34, 1.30, 0.64, 1)';
    const DEAL_INITIAL_SCALE    = 0.72;
    const DEAL_SPIN_DEG         = 360;
    const DEAL_NATURAL_ROTATIONS = [-10, -3, 3, 10];

    function emergeDealCardsFromButton(btnRect) {
        return new Promise(resolve => {
            const dealCards = Array.from(document.querySelectorAll('.deal-card'));
            const overlay = document.getElementById('role-deal-overlay');
            if (!dealCards.length || !overlay) { resolve(); return; }
            const btnCx = btnRect.left + btnRect.width / 2;
            const btnCy = btnRect.top + btnRect.height / 2;

            requestAnimationFrame(() => {
                const overlayRect = overlay.getBoundingClientRect();
                const dx = btnCx - (overlayRect.left + overlayRect.width / 2);
                const dy = btnCy - (overlayRect.top + overlayRect.height / 2);

                dealCards.forEach((card, i) => {
                    const naturalRot = DEAL_NATURAL_ROTATIONS[i] || 0;
                    const rot = naturalRot - DEAL_SPIN_DEG;
                    card.style.transition = 'none';
                    card.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${DEAL_INITIAL_SCALE}) rotate(${rot}deg)`;
                    card.style.opacity = '0';
                });

                overlay.getBoundingClientRect();

                requestAnimationFrame(() => {
                    dealCards.forEach((card, i) => {
                        const delay = i * DEAL_STAGGER_MS;
                        card.style.transition =
                            `transform ${DEAL_DURATION_MS}ms ${DEAL_EASE} ${delay}ms, ` +
                            `opacity ${DEAL_OPACITY_MS}ms ease-out ${delay}ms`;
                        card.style.transform = '';
                        card.style.opacity = '';
                    });
                    const total = DEAL_DURATION_MS + (dealCards.length - 1) * DEAL_STAGGER_MS + 80;
                    setTimeout(() => {
                        dealCards.forEach(card => {
                            card.style.transition = '';
                            card.style.transform = '';
                            card.style.opacity = '';
                        });
                        resolve();
                    }, total);
                });
            });
        });
    }

    function waitForClick(el) {
        return new Promise(resolve => {
            const mySession = gameSessionId;
            const handler = () => {
                el.removeEventListener('click', handler);
                if (stale(mySession)) return;
                resolve();
            };
            el.addEventListener('click', handler);
        });
    }

    function updateIndicators(values) {
        document.querySelectorAll('.player-corner .bar').forEach(bar => {
            const ind = bar.dataset.indicator;
            const val = values[ind];
            const filledClass = val < 3 ? 'pip filled danger' : 'pip filled';
            bar.innerHTML = Array.from({ length: MAX_INDICATOR }, (_, i) =>
                `<span class="${i < val ? filledClass : 'pip'}"></span>`
            ).join('');
        });
    }

    async function startGame(originRect = null) {
        const mySession = ++gameSessionId;

        gameState = { confianza: 4, informacion: 4, pluralismo: 4, participacion: 4 };
        firstRoundPending = true;
        roundNumber = 1;
        updateRoundCounter();
        revealingEffects = false;
        selectedDecision = null;
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('selected'));
        assignRoles();
        updateIndicators(gameState);

        if (originRect) {
            screens.start.classList.add('leaving');
            Object.values(screens).forEach(s => { if (s !== screens.start) s.classList.remove('active'); });
            screens.game.classList.add('active');

            await dealRolesShowAndEmerge(originRect, emergeGameFromButton(originRect));
            if (stale(mySession)) return;
            screens.start.classList.remove('active', 'leaving');

            await dealRolesWaitAndHide();
            if (stale(mySession)) return;
        } else {
            showScreen('game');
            await dealRoles(originRect);
            if (stale(mySession)) return;
        }

        startRound();
    }

    function emergeGameFromButton(btnRect) {
        return new Promise(resolve => {
            const btnCx = btnRect.left + btnRect.width / 2;
            const btnCy = btnRect.top + btnRect.height / 2;
            const elements = [
                ...document.querySelectorAll('#screen-game .player-corner'),
                document.querySelector('#screen-game .dashboard'),
                document.getElementById('btn-exit-game')
            ].filter(Boolean);
            if (!elements.length) { resolve(); return; }

            screens.game.classList.add('emerging');

            const layout = elements.map(el => {
                const rect = el.getBoundingClientRect();
                return {
                    dx: btnCx - (rect.left + rect.width / 2),
                    dy: btnCy - (rect.top + rect.height / 2)
                };
            });

            const mid = (elements.length - 1) / 2;

            elements.forEach((el, i) => {
                const { dx, dy } = layout[i];
                const rot = (i - mid) * 10;
                el.style.transition = 'none';
                el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${EMERGE_INITIAL_SCALE}) rotate(${rot}deg)`;
                el.style.opacity = '0';
            });

            screens.game.getBoundingClientRect();

            requestAnimationFrame(() => {
                elements.forEach((el, i) => {
                    const delay = i * EMERGE_STAGGER_MS;
                    el.style.transition =
                        `transform ${EMERGE_DURATION_MS}ms ${EMERGE_EASE} ${delay}ms, ` +
                        `opacity ${EMERGE_OPACITY_MS}ms ${EMERGE_EASE} ${delay}ms`;
                    el.style.transform = '';
                    el.style.opacity = '';
                });
                const total = EMERGE_DURATION_MS + (elements.length - 1) * EMERGE_STAGGER_MS + 60;
                setTimeout(() => {
                    screens.game.classList.remove('emerging');
                    elements.forEach(el => {
                        el.style.transition = '';
                        el.style.transform = '';
                        el.style.opacity = '';
                    });
                    resolve();
                }, total);
            });
        });
    }

    async function startRound() {
        await loadCards();
        await runRoundTurns();
    }

    let cardsPool = null;

    // La primera ronda de cada partida usa siempre estas dos cartas (si existen en
    // el mazo); a partir de la 2ª ronda, vuelven a salir de forma aleatoria.
    const FIRST_SCENARIO_TEXT = 'Un vídeo editado con IA deja fatal a un concejal…';
    const FIRST_SYMPTOM_TEXT = '…y nadie sabe si el vídeo es real, IA o el primo de alguien.';
    let firstRoundPending = false;
    let roundNumber = 1;

    function updateRoundCounter() {
        const el = document.getElementById('round-counter');
        if (el) el.textContent = `RONDA ${roundNumber}`;
    }

    async function loadCardsPool() {
        if (cardsPool) return cardsPool;
        // Versión fija: el navegador cachea el JSON. Sube el número al editar cards.json.
        const res = await fetch('assets/data/cards.json?v=1');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cardsPool = await res.json();
        return cardsPool;
    }

    function drawRandom(pool) {
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Escenario (A) de la ronda: en la 1ª ronda fuerza el escenario fijo si está
    // disponible; si no lo encuentra (o ya no es la 1ª ronda), cae a aleatorio.
    function pickScenarioA(deckA, isFirstRound) {
        if (isFirstRound) {
            const opener = deckA.find(c => c && c.text === FIRST_SCENARIO_TEXT);
            if (opener) return opener;
        }
        return drawRandom(deckA);
    }

    // Segunda carta (B) del escenario: en la 1ª ronda fuerza la carta fija si está
    // disponible; si no, cae a la selección compatible con A de siempre.
    function pickSymptomB(cardA, deckB, isFirstRound) {
        if (isFirstRound) {
            const opener = deckB.find(c => c && c.text === FIRST_SYMPTOM_TEXT);
            if (opener) return opener;
        }
        return drawCardBForA(cardA, deckB);
    }

    // === Selección compatible A → B ===========================================
    // Las cartas A pueden traer (opcional):  { family: string, tags: string[] }
    // Las cartas B pueden traer (opcional):  { families: string[], tags: string[] }
    // Si A no tiene family/tags, o si no hay ninguna B compatible, se cae a
    // selección aleatoria — el JSON antiguo sigue funcionando igual que antes.
    const DEV_LOG_CARDS = false;

    function shareTags(tagsA, tagsB) {
        if (!Array.isArray(tagsA) || !Array.isArray(tagsB)) return false;
        return tagsA.some(tag => tagsB.includes(tag));
    }

    function isCompatibleCard(cardA, cardB) {
        if (!cardA || !cardB) return false;
        const familyMatch =
            !!cardA.family &&
            Array.isArray(cardB.families) &&
            cardB.families.includes(cardA.family);
        const tagMatch =
            Array.isArray(cardA.tags) &&
            Array.isArray(cardB.tags) &&
            shareTags(cardA.tags, cardB.tags);
        return familyMatch || tagMatch;
    }

    function getCompatibleBCards(cardA, deckB) {
        if (!Array.isArray(deckB)) return [];
        return deckB.filter(cardB => isCompatibleCard(cardA, cardB));
    }

    function drawCardBForA(cardA, deckB) {
        const compatible = getCompatibleBCards(cardA, deckB);
        const pool = compatible.length > 0 ? compatible : deckB;
        if (DEV_LOG_CARDS) {
            console.log('[cards] A:', cardA && cardA.text);
            console.log('[cards] B compatibles:', compatible.length, '/', deckB.length);
            if (compatible.length) console.log('[cards] B candidatas:', compatible.map(c => c.text));
        }
        return drawRandom(pool);
    }

    async function loadCards() {
        const area = document.getElementById('cards-area');
        area.innerHTML = '<p class="cards-loading">Robando cartas…</p>';
        try {
            const pool = await loadCardsPool();
            if (!pool || !Array.isArray(pool.A) || !Array.isArray(pool.B) || !pool.A.length || !pool.B.length) {
                throw new Error('Pool de cartas vacío o inválido');
            }
            const isFirstRound = firstRoundPending;
            firstRoundPending = false;
            const cardA = pickScenarioA(pool.A, isFirstRound);
            const cardB = pickSymptomB(cardA, pool.B, isFirstRound);
            if (DEV_LOG_CARDS) console.log('[cards] B elegida:', cardB && cardB.text);
            renderCards({ A: cardA, B: cardB });
        } catch (err) {
            area.innerHTML = `<p class="cards-error">Error cargando cartas: ${err.message}</p>`;
        }
    }

    const INDICATOR_LABELS = {
        confianza: 'Confianza',
        informacion: 'Información',
        pluralismo: 'Pluralismo',
        participacion: 'Participación'
    };

    const INDICATOR_ABBR = {
        confianza_delta: 'C',
        informacion_delta: 'I',
        pluralismo_delta: 'Pl',
        participacion_delta: 'Pa'
    };

    let currentHand = null;
    let selectedDecision = null;
    let revealingEffects = false;
    let gameState = { confianza: 4, informacion: 4, pluralismo: 4, participacion: 4 };

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function applyEffect(effects, decision) {
        const e = effects.find(x => x.decision === decision);
        if (!e) return;
        const indicators = ['confianza', 'informacion', 'pluralismo', 'participacion'];
        indicators.forEach(ind => {
            const raw = Number(e[`${ind}_delta`]);
            const before = gameState[ind];
            const after = clamp(before + raw, 0, MAX_INDICATOR);
            const actual = after - before;
            gameState[ind] = after;
            if (actual !== 0) showIndicatorDelta(ind, actual);
        });
        updateIndicators(gameState);
    }

    function showIndicatorDelta(indicator, delta) {
        const bar = document.querySelector(`.player-corner .bar[data-indicator="${indicator}"]`);
        if (!bar) return;
        const corner = bar.closest('.player-corner');
        if (!corner) return;
        const float = document.createElement('div');
        float.className = `indicator-delta ${delta > 0 ? 'positive' : 'negative'}`;
        float.textContent = (delta > 0 ? '+' : '') + delta;
        corner.appendChild(float);
        setTimeout(() => float.remove(), 1700);
    }

    const POKE_TYPES = [
        { id: 'fuego',      label: 'Fuego',      icon: '🔥' },
        { id: 'agua',       label: 'Agua',       icon: '💧' },
        { id: 'bosque',     label: 'Bosque',     icon: '🌿' },
        { id: 'electrico',  label: 'Eléctrico',  icon: '⚡' },
        { id: 'psiquico',   label: 'Psíquico',   icon: '🔮' },
        { id: 'tierra',     label: 'Tierra',     icon: '🪨' }
    ];

    function randomPokeType() {
        return POKE_TYPES[Math.floor(Math.random() * POKE_TYPES.length)];
    }

    function randInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    function renderCards(hand) {
        currentHand = hand;
        const area = document.getElementById('cards-area');
        area.innerHTML = ['A', 'B'].map(deck => {
            const type = randomPokeType();
            const name = 'Escenario';
            const hp = (Math.floor(Math.random() * 7) + 4) * 10;
            const tiltMag = randInRange(5, 9);
            const rot = (Math.random() < 0.5 ? -tiltMag : tiltMag).toFixed(2);
            const dx  = randInRange(-8, 8).toFixed(1);
            const dy  = randInRange(-5, 5).toFixed(1);
            const tilt = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
            return `
                <div class="card pokecard" data-deck="${deck}" data-type="${type.id}" style="transform: ${tilt};">
                    <div class="pokecard-header">
                        <span class="pokecard-name">${name} · ${deck}</span>
                        <span class="pokecard-hp">PS ${hp}</span>
                    </div>
                    <div class="pokecard-art">
                        <span class="pokecard-art-watermark" aria-hidden="true">${type.icon}</span>
                        <p class="pokecard-text">${escapeHtml(hand[deck].text)}</p>
                    </div>
                    <div class="pokecard-typebar">
                        <span class="pokecard-type-badge" aria-hidden="true">${type.icon}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderEffectsTable(effects) {
        return `
            <div class="effects-table">
                ${effects.map(e => `
                    <div class="effect-row${e.decision === selectedDecision ? ' chosen' : ''}">
                        <span class="effect-decision">${escapeHtml(e.decision)}</span>
                        <span class="effect-chips">${formatDeltaChips(e)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function formatDeltaChips(effect) {
        const chips = Object.entries(INDICATOR_ABBR)
            .filter(([key]) => effect[key] !== 0)
            .map(([key, abbr]) => {
                const v = Number(effect[key]);
                const sign = v > 0 ? '+' : '';
                const cls = v > 0 ? 'positive' : 'negative';
                return `<span class="delta ${cls}">${sign}${v} ${abbr}</span>`;
            })
            .join('');
        return chips || '<span class="delta zero">—</span>';
    }

    async function revealEffects() {
        cancelDecisionTimer();
        await wait(400);
        await flipAndApply('A');
        await flipAndApply('B');
    }

    async function flipAndApply(deck) {
        const cardEl = document.querySelector(`.card[data-deck="${deck}"]`);
        cardEl.classList.add('flipping');
        await wait(350);
        const artEl = cardEl.querySelector('.pokecard-art');
        const tableHtml = renderEffectsTable(currentHand[deck].effects || []);
        if (artEl) {
            const watermarkHtml = artEl.querySelector('.pokecard-art-watermark')?.outerHTML || '';
            artEl.innerHTML = watermarkHtml + tableHtml;
        } else {
            cardEl.innerHTML = tableHtml;
        }
        cardEl.classList.add('flipped');
        cardEl.classList.remove('flipping');
        await wait(250);
        applyEffect(currentHand[deck].effects || [], selectedDecision);
        await wait(500);
    }

    function checkGameOver() {
        const losers = playerRoles
            .map((role, i) => ({ playerNum: i + 1, role, value: gameState[role.indicator] }))
            .filter(p => p.value <= 0);
        return losers.length > 0 ? losers : null;
    }

    function showEndScreen(losers) {
        const info = document.getElementById('end-info');
        if (losers.length === 1) {
            const l = losers[0];
            info.innerHTML = `
                <p><strong>${l.role.label}</strong> ha llegado a 0.</p>
                <p>Pierde <strong>Jugador ${l.playerNum}</strong> — ${l.role.name}.</p>
            `;
        } else {
            info.innerHTML = `
                <p>Múltiples indicadores en crisis. Derrota compartida:</p>
                <ul>${losers.map(l =>
                    `<li><strong>${l.role.label}</strong> — Jugador ${l.playerNum} (${l.role.name})</li>`
                ).join('')}</ul>
            `;
        }
        showScreen('end');
    }

    async function nextRound() {
        const mySession = gameSessionId;
        roundNumber++;
        updateRoundCounter();
        revealingEffects = false;
        selectedDecision = null;
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('selected'));
        await loadCards();
        if (stale(mySession)) return;
        await runRoundTurns();
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    let timerInterval;
    let turnPhaseActive = false;
    let decisionTimerResolve = null;

    function formatTime(time) {
        const mins = Math.floor(time / 60);
        const secs = time % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function runCountdown(seconds, extraEl = null) {
        return new Promise(resolve => {
            clearInterval(timerInterval);
            let time = seconds;
            const timerEl = document.getElementById('timer');
            timerEl.classList.add('counting');
            const update = () => {
                const t = formatTime(Math.max(0, time));
                timerEl.textContent = t;
                if (extraEl) extraEl.textContent = t;
            };
            update();
            timerInterval = setInterval(() => {
                time--;
                update();
                if (time <= 0) {
                    clearInterval(timerInterval);
                    timerEl.classList.remove('counting');
                    resolve();
                }
            }, 1000);
        });
    }

    function startDecisionTimer(seconds) {
        return new Promise(resolve => {
            decisionTimerResolve = resolve;
            clearInterval(timerInterval);
            let time = seconds;
            const timerEl = document.getElementById('timer');
            timerEl.textContent = formatTime(time);
            timerEl.classList.add('counting');
            timerInterval = setInterval(() => {
                time--;
                timerEl.textContent = formatTime(Math.max(0, time));
                if (time <= 0) {
                    clearInterval(timerInterval);
                    timerEl.classList.remove('counting');
                    if (decisionTimerResolve) {
                        decisionTimerResolve('timeout');
                        decisionTimerResolve = null;
                    }
                }
            }, 1000);
        });
    }

    function cancelDecisionTimer() {
        clearInterval(timerInterval);
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.classList.remove('counting');
        if (decisionTimerResolve) {
            decisionTimerResolve('decided');
            decisionTimerResolve = null;
        }
    }

    async function flashTurn(playerLabel, bigText, subText = '') {
        const overlay = document.getElementById('turn-overlay');
        overlay.querySelector('.turn-player').textContent = playerLabel;
        overlay.querySelector('.turn-role').textContent = bigText;
        overlay.querySelector('.turn-time').textContent = '';
        const consignaEl = overlay.querySelector('.turn-consigna');
        if (consignaEl) consignaEl.textContent = '';
        const subEl = overlay.querySelector('.turn-subtext');
        if (subEl) subEl.textContent = subText;
        overlay.classList.add('visible');
        await wait(subText ? 15200 : 1700);
        overlay.classList.remove('visible');
        if (subEl) subEl.textContent = '';
        await wait(380);
    }

    async function playerTurn(label, roleName, seconds, consigna = '') {
        const overlay = document.getElementById('turn-overlay');
        const card = overlay.querySelector('.turn-card');
        const timeEl = overlay.querySelector('.turn-time');
        const consignaEl = overlay.querySelector('.turn-consigna');
        overlay.querySelector('.turn-player').textContent = label;
        overlay.querySelector('.turn-role').textContent = roleName;
        if (consignaEl) consignaEl.textContent = consigna;
        timeEl.textContent = formatTime(seconds);
        // Fase de lectura: durante TURN_READ_MS solo se ve la consigna
        if (card) card.classList.add('consigna-only');
        overlay.classList.add('visible');
        await wait(TIMINGS.TURN_READ_MS);
        // La consigna se desvanece suavemente; después aparecen el nombre y el tiempo
        if (consignaEl) consignaEl.classList.add('is-leaving');
        await wait(360);
        if (card) { card.classList.remove('consigna-only'); card.classList.add('info-entering'); }
        if (consignaEl) { consignaEl.textContent = ''; consignaEl.classList.remove('is-leaving'); }
        setTimeout(() => { if (card) card.classList.remove('info-entering'); }, 420);
        await runCountdown(seconds, timeEl);
        overlay.classList.remove('visible');
        await wait(380);
    }

    function waitForStart() {
        return new Promise(resolve => {
            const mySession = gameSessionId;
            const overlay = document.getElementById('turn-overlay');
            overlay.querySelector('.turn-player').textContent = 'Lectura inicial';
            overlay.querySelector('.turn-role').textContent = 'Leed el escenario';
            overlay.querySelector('.turn-time').textContent = '';
            const consignaEl = overlay.querySelector('.turn-consigna');
            if (consignaEl) consignaEl.textContent = '';
            const btn = document.getElementById('btn-start-reading');
            btn.textContent = 'START';
            btn.style.display = 'inline-block';
            overlay.classList.add('visible', 'reading');
            screens.game.classList.add('reading-mode');
            const onClick = async () => {
                btn.removeEventListener('click', onClick);
                if (stale(mySession)) return;
                btn.style.display = 'none';
                overlay.classList.remove('visible');
                screens.game.classList.remove('reading-mode');
                hideRoleInfo();
                await wait(380);
                if (stale(mySession)) return;
                overlay.classList.remove('reading');
                resolve();
            };
            btn.addEventListener('click', onClick);
        });
    }

    function showRoleInfo(playerNum, role) {
        const ov = document.getElementById('role-info-overlay');
        if (!ov) return;
        ov.querySelector('.deal-player').textContent = `Jugador ${playerNum}`;
        ov.querySelector('.deal-role').textContent = role.name;
        ov.querySelector('.deal-desc').innerHTML = role.description;
        setRolePortrait(
            ov.querySelector('.deal-role-portrait'),
            ov.querySelector('.deal-role-img'),
            role
        );
        ov.classList.add('visible');
    }

    function hideRoleInfo() {
        const ov = document.getElementById('role-info-overlay');
        if (ov) ov.classList.remove('visible');
    }

    document.querySelectorAll('.player-corner').forEach(corner => {
        corner.addEventListener('click', (e) => {
            if (!screens.game.classList.contains('reading-mode')) return;
            e.stopPropagation();
            const playerNum = parseInt(corner.id.replace('player-', ''), 10);
            const role = playerRoles[playerNum - 1];
            if (!role) return;
            showRoleInfo(playerNum, role);
        });
    });

    const roleInfoOv = document.getElementById('role-info-overlay');
    if (roleInfoOv) {
        // Pulsar en cualquier punto (tarjeta o fondo) cierra la info del rol
        roleInfoOv.addEventListener('click', () => hideRoleInfo());
    }

    async function runRoundTurns() {
        const mySession = gameSessionId;
        turnPhaseActive = true;
        await waitForStart();
        if (stale(mySession)) return;

        const consignas = pickConsignas(4);
        for (let i = 0; i < 4; i++) {
            const role = playerRoles[i];
            await playerTurn(`Jugador ${i + 1}`, role.name, TIMINGS.PLAYER_TURN_SEC, consignas[i]);
            if (stale(mySession)) return;
        }

        await flashTurn('Decisión común', TIMINGS.DECISION_LABEL,
            'Como presidenta, resume las 4 posturas, di dónde hay acuerdo y dónde no, y guía al grupo hacia una decisión común. Cuando estéis listos, pulsad la decisión acordada.');
        if (stale(mySession)) return;
        turnPhaseActive = false;

        const result = await startDecisionTimer(TIMINGS.DECISION_SEC);
        if (stale(mySession)) return;
        if (result === 'timeout' && !revealingEffects) {
            handleDecisionTimeout();
        }
    }

    function handleDecisionTimeout() {
        const info = document.getElementById('end-info');
        info.innerHTML = `
            <p>Se ha agotado el tiempo de deliberación.</p>
            <p><strong>Habéis perdido todos.</strong></p>
        `;
        showScreen('end');
    }

    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (revealingEffects || turnPhaseActive) return;
            if (e.target.classList.contains('action-info-btn')) return;
            const mySession = gameSessionId;
            document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedDecision = btn.dataset.action;
            revealingEffects = true;
            await revealEffects();
            if (stale(mySession) || !screens.game.classList.contains('active')) return;
            // Pausa para ver el reverso de las cartas con el resultado de la decisión
            await wait(TIMINGS.REVEAL_VIEW_MS);
            if (stale(mySession) || !screens.game.classList.contains('active')) return;
            await showRoundSummary(currentHand, selectedDecision);
            if (stale(mySession) || !screens.game.classList.contains('active')) return;
            const losers = checkGameOver();
            if (losers) {
                showEndScreen(losers);
            } else {
                nextRound();
            }
        });
    });

    function showRoundSummary(hand, decision) {
        return new Promise(resolve => {
            const mySession = gameSessionId;
            const overlay = document.getElementById('round-summary-overlay');
            if (!overlay || !hand || !decision) { resolve(); return; }

            ['A', 'B'].forEach(deck => {
                const section = overlay.querySelector(`.round-summary-section[data-deck="${deck}"]`);
                if (!section) return;
                const card = hand[deck];
                const eff = card && Array.isArray(card.effects)
                    ? card.effects.find(x => x.decision === decision)
                    : null;
                const txtEl = section.querySelector('.round-summary-text');
                const expl = eff && eff.explanation && String(eff.explanation).trim();
                if (expl) {
                    txtEl.textContent = expl;
                    txtEl.classList.remove('empty');
                } else {
                    txtEl.textContent = '(Sin explicación añadida todavía.)';
                    txtEl.classList.add('empty');
                }

                const deltasEl = section.querySelector('.round-summary-deltas');
                if (deltasEl) {
                    if (eff) {
                        deltasEl.innerHTML = Object.keys(INDICATOR_LABELS).map(ind => {
                            const v = Number(eff[`${ind}_delta`]) || 0;
                            const sign = v > 0 ? '+' : '';
                            const cls = v > 0 ? 'positive' : (v < 0 ? 'negative' : 'zero');
                            return `<div class="round-summary-delta ${cls}">`
                                + `<span class="round-summary-delta-label">${INDICATOR_LABELS[ind]}</span>`
                                + `<span class="round-summary-delta-value">${sign}${v}</span>`
                                + `</div>`;
                        }).join('');
                    } else {
                        deltasEl.innerHTML = '';
                    }
                }
            });

            overlay.classList.add('visible');

            const continueBtn = overlay.querySelector('.round-summary-continue');
            const onClick = () => {
                continueBtn.removeEventListener('click', onClick);
                if (stale(mySession)) return;
                overlay.classList.remove('visible');
                resolve();
            };
            continueBtn.addEventListener('click', onClick);
        });
    }

    const ACTION_DESCRIPTIONS = {
        'Comprobar': 'El grupo decide comprobar mejor los hechos antes de actuar. Es una respuesta prudente frente al ruido, los bulos y las versiones interesadas. Puede evitar errores graves, pero también hacer que la ciudad reaccione demasiado tarde.',
        'Escuchar': 'El grupo decide escuchar a más personas antes de cerrar una decisión. Da importancia a las voces afectadas y evita decidir solo desde arriba. Puede hacer que la decisión sea más legítima, pero también que el acuerdo sea más difícil.',
        'Proteger': 'El grupo decide proteger a quienes pueden salir más perjudicados por la situación. Es una respuesta centrada en derechos, garantías y límites al abuso. Puede evitar daños injustos, pero también generar tensión con quienes quieren una solución más rápida o mayoritaria.',
        'Actuar ya': 'El grupo decide actuar rápido y cerrar el debate. Es una respuesta útil cuando hay urgencia, bloqueo o falta de tiempo. Puede evitar la parálisis, pero también parecer una imposición si no se explica bien.'
    };

    document.querySelectorAll('.action-btn').forEach(btn => {
        const info = document.createElement('span');
        info.className = 'action-info-btn';
        info.setAttribute('aria-label', 'Más información');
        info.textContent = 'i';
        btn.appendChild(info);
        info.addEventListener('click', (e) => {
            e.stopPropagation();
            showActionInfo(btn.dataset.action);
        });
    });

    function showActionInfo(actionName) {
        const ov = document.getElementById('action-info-overlay');
        if (!ov || !ACTION_DESCRIPTIONS[actionName]) return;
        ov.querySelector('.action-info-name').textContent = actionName;
        ov.querySelector('.action-info-desc').innerHTML = ACTION_DESCRIPTIONS[actionName];
        ov.classList.add('visible');
    }

    function hideActionInfo() {
        const ov = document.getElementById('action-info-overlay');
        if (ov) ov.classList.remove('visible');
    }

    const actionInfoOv = document.getElementById('action-info-overlay');
    if (actionInfoOv) {
        // Pulsar en cualquier punto (tarjeta o fondo) cierra la info de la acción
        actionInfoOv.addEventListener('click', () => hideActionInfo());
    }
});
