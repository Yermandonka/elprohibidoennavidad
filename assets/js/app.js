document.addEventListener('DOMContentLoaded', () => {
    // === Tiempos del juego (ajustar aquí para pruebas) ===
    const TIMINGS = {
        PLAYER_TURN_SEC:     10,     // segundos por turno de cada jugador
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

    document.getElementById('btn-new-game').addEventListener('click', (e) => {
        startGame(e.currentTarget.getBoundingClientRect());
    });

    let lastRulesButtonRect = null;

    document.getElementById('btn-rules').addEventListener('click', (e) => {
        lastRulesButtonRect = e.currentTarget.getBoundingClientRect();
        emergeRulesFromButton(lastRulesButtonRect);
    });

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
        if (e.target !== e.currentTarget) return;
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

    // Zonas táctiles laterales para navegar en móvil (cubre la zona detrás de la carta activa)
    if (rulesDeckEl) {
        rulesDeckEl.addEventListener('click', (e) => {
            if (window.innerWidth > 720) return;
            const targetCard = e.target.closest('.rules-card');
            if (targetCard && (targetCard.classList.contains('prev') || targetCard.classList.contains('next'))) return;
            if (e.target.closest('.rules-scroll-down')) return;
            const rect = rulesDeckEl.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const w = rect.width;
            if (x < w * 0.22) goToRuleCard(currentRuleIndex - 1);
            else if (x > w * 0.78) goToRuleCard(currentRuleIndex + 1);
        });
    }

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

    const MAX_INDICATOR = 8;

    const ROLES = [
        { name: 'Roro La Carnicera', indicator: 'pluralismo', label: 'Pluralismo',
          image: 'roro.png',
          description: 'Treinta años detrás del mostrador. Le entran clientes de todos los colores y de todos los humores, y todos tienen que seguir entrando mañana. Quiere que en el barrio sigan cabiendo todos, su indicador es <span class="kw-pluralismo">Pluralismo</span>.' },
        { name: 'Martín Presidente del Gobierno', indicator: 'participacion', label: 'Participación',
          image: 'martin.png',
          description: 'Agenda partida en bloques de quince minutos y la certeza de que cualquier decisión saldrá mal en algún titular. Su empeño: que las reglas se cumplan y el país mejore paso a paso, su indicador es <span class="kw-participacion">Participación</span>.' },
        { name: 'Belén La Redactora', indicator: 'informacion', label: 'Información',
          image: 'belen.png',
          description: 'Poco presupuesto, mucho trabajo. Pelea a diario contra bulos, fuentes interesadas y la tentación del titular fácil. Quiere proteger la labor periodística, su indicador es <span class="kw-info">Información</span>.' },
        { name: 'Florentino El Empresario', indicator: 'confianza', label: 'Confianza',
          image: 'florentino.png',
          description: 'Empresa heredada, doce empleados, nóminas que pagar el día 30. Sin reglas estables, se le caen los planes a tres meses vista. Quiere que las reglas no cambien con el viento, su indicador es <span class="kw-confianza">Confianza</span>.' }
    ];

    let playerRoles = [];

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

    async function dealRoles(originRect = null) {
        const overlay = document.getElementById('role-deal-overlay');
        overlay.classList.remove('dealt');
        overlay.classList.add('visible');
        if (originRect) await emergeDealCardsFromButton(originRect);
        await waitForClick(overlay);
        overlay.classList.add('dealt');
        await wait(900);
        overlay.classList.remove('visible');
        overlay.classList.remove('dealt');
    }

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
                    card.style.transition = 'none';
                    card.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.06) rotate(${(i - 1.5) * 4}deg)`;
                    card.style.opacity = '0';
                });

                overlay.getBoundingClientRect();

                requestAnimationFrame(() => {
                    dealCards.forEach(card => {
                        card.style.transition = '';
                        card.style.transform = '';
                        card.style.opacity = '';
                    });
                    setTimeout(resolve, 900);
                });
            });
        });
    }

    function waitForClick(el) {
        return new Promise(resolve => {
            const handler = () => {
                el.removeEventListener('click', handler);
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
        if (originRect) {
            screens.start.classList.add('leaving');
            Object.values(screens).forEach(s => { if (s !== screens.start) s.classList.remove('active'); });
            screens.game.classList.add('active');
            setTimeout(() => {
                screens.start.classList.remove('active', 'leaving');
            }, 650);
        } else {
            showScreen('game');
        }
        gameState = { confianza: 4, informacion: 4, pluralismo: 4, participacion: 4 };
        revealingEffects = false;
        selectedDecision = null;
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('selected'));
        assignRoles();
        updateIndicators(gameState);
        await dealRoles(originRect);
        startRound();
    }

    async function startRound() {
        await loadCards();
        await runRoundTurns();
    }

    let cardsDeck = null;

    async function ensureCardsDeck() {
        if (cardsDeck) return cardsDeck;
        const res = await fetch('assets/data/cards.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cardsDeck = await res.json();
        return cardsDeck;
    }

    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    async function loadCards() {
        const area = document.getElementById('cards-area');
        area.innerHTML = '<p class="cards-loading">Robando cartas…</p>';
        try {
            const deck = await ensureCardsDeck();
            if (!deck.A || !deck.A.length || !deck.B || !deck.B.length) {
                throw new Error('No hay cartas en los mazos.');
            }
            const hand = { A: pickRandom(deck.A), B: pickRandom(deck.B) };
            renderCards(hand);
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
        gameState.confianza   = clamp(gameState.confianza   + Number(e.confianza_delta),   0, MAX_INDICATOR);
        gameState.informacion = clamp(gameState.informacion + Number(e.informacion_delta), 0, MAX_INDICATOR);
        gameState.pluralismo  = clamp(gameState.pluralismo  + Number(e.pluralismo_delta),  0, MAX_INDICATOR);
        gameState.participacion = clamp(gameState.participacion + Number(e.participacion_delta), 0, MAX_INDICATOR);
        updateIndicators(gameState);
    }

    function renderCards(hand) {
        currentHand = hand;
        const area = document.getElementById('cards-area');
        area.innerHTML = ['A', 'B'].map(deck => `
            <div class="card" data-deck="${deck}">
                <div class="card-letter">${deck}</div>
                <p class="card-text">${escapeHtml(hand[deck].text)}</p>
            </div>
        `).join('');
    }

    function renderEffectsTable(effects) {
        return `
            <div class="effects-table">
                ${effects.map(e => `
                    <div class="effect-row${e.decision === selectedDecision ? ' chosen' : ''}">
                        <span class="effect-decision">${e.decision}</span>
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
        if (await maybeEndGame()) return;
        await flipAndApply('B');
        await maybeEndGame();
    }

    async function flipAndApply(deck) {
        const cardEl = document.querySelector(`.card[data-deck="${deck}"]`);
        cardEl.classList.add('flipping');
        await wait(350);
        cardEl.innerHTML = renderEffectsTable(currentHand[deck].effects || []);
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

    async function maybeEndGame() {
        const losers = checkGameOver();
        if (!losers) return false;
        await wait(1200);
        showEndScreen(losers);
        return true;
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
        revealingEffects = false;
        selectedDecision = null;
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('selected'));
        assignRoles();
        await loadCards();
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
            timerInterval = setInterval(() => {
                time--;
                timerEl.textContent = formatTime(Math.max(0, time));
                if (time <= 0) {
                    clearInterval(timerInterval);
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
        if (decisionTimerResolve) {
            decisionTimerResolve('decided');
            decisionTimerResolve = null;
        }
    }

    async function flashTurn(playerLabel, bigText) {
        const overlay = document.getElementById('turn-overlay');
        overlay.querySelector('.turn-player').textContent = playerLabel;
        overlay.querySelector('.turn-role').textContent = bigText;
        overlay.querySelector('.turn-time').textContent = '';
        overlay.classList.add('visible');
        await wait(1700);
        overlay.classList.remove('visible');
        await wait(380);
    }

    async function playerTurn(label, roleName, seconds) {
        const overlay = document.getElementById('turn-overlay');
        const timeEl = overlay.querySelector('.turn-time');
        overlay.querySelector('.turn-player').textContent = label;
        overlay.querySelector('.turn-role').textContent = roleName;
        timeEl.textContent = formatTime(seconds);
        overlay.classList.add('visible');
        await runCountdown(seconds, timeEl);
        overlay.classList.remove('visible');
        await wait(380);
    }

    function waitForStart() {
        return new Promise(resolve => {
            const overlay = document.getElementById('turn-overlay');
            overlay.querySelector('.turn-player').textContent = 'Lectura inicial';
            overlay.querySelector('.turn-role').textContent = 'Leed el escenario';
            overlay.querySelector('.turn-time').textContent = '';
            const btn = document.getElementById('btn-start-reading');
            btn.style.display = 'inline-block';
            overlay.classList.add('visible', 'reading');
            screens.game.classList.add('reading-mode');
            const onClick = async () => {
                btn.removeEventListener('click', onClick);
                btn.style.display = 'none';
                overlay.classList.remove('visible');
                screens.game.classList.remove('reading-mode');
                hideRoleInfo();
                await wait(380);
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
        roleInfoOv.addEventListener('click', (e) => {
            if (e.target === roleInfoOv) hideRoleInfo();
        });
    }

    async function runRoundTurns() {
        turnPhaseActive = true;
        await waitForStart();

        for (let i = 0; i < 4; i++) {
            const role = playerRoles[i];
            await playerTurn(`Jugador ${i + 1}`, role.name, TIMINGS.PLAYER_TURN_SEC);
        }
        turnPhaseActive = false;

        await flashTurn('Decisión común', TIMINGS.DECISION_LABEL);
        const result = await startDecisionTimer(TIMINGS.DECISION_SEC);
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
            document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedDecision = btn.dataset.action;
            revealingEffects = true;
            await revealEffects();
            if (!screens.game.classList.contains('active')) return;
            await wait(TIMINGS.BETWEEN_ROUNDS_MS);
            if (!screens.game.classList.contains('active')) return;
            nextRound();
        });
    });

    const ACTION_DESCRIPTIONS = {
        'Contrastar': 'Antes de aplicar consecuencias, el grupo tiene que nombrar al menos <strong>dos fuentes o datos concretos</strong> del escenario, uno que apoye y otro que cuestione la versión dominante. Si no se encuentran las dos, la acción no se puede ejecutar y hay que elegir otra. Lleva tiempo, pero blinda la decisión frente a bulos.',
        'Consultar': 'Cada jugador identifica <strong>un grupo afectado fuera de los cuatro roles</strong> (estudiantes, vecinos del barrio, profesores interinos, pequeños comerciantes… lo que aplique al escenario) y habla <strong>15 segundos en su nombre</strong>. La decisión final debe incorporar explícitamente al menos una de esas voces.',
        'Blindar': 'El grupo nombra <strong>explícitamente a la persona, colectivo o minoría</strong> que más puede salir perjudicada en este escenario concreto y enuncia <strong>una salvaguarda específica</strong> para ellos (por ejemplo: "se mantiene el anonimato de los denunciantes" o "se garantiza acceso al servicio durante el conflicto"). Si nadie consigue nombrar a quién proteger ni cómo, no se puede usar esta acción.',
        'Decretar': 'Votación <strong>inmediata, sin más debate</strong>. La decisión queda vinculante y rápida. Salva tiempo, pero el grupo renuncia a las garantías de las otras tres acciones, y eso debe pasar factura en las cartas B.'
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
        actionInfoOv.addEventListener('click', (e) => {
            if (e.target === actionInfoOv) hideActionInfo();
        });
    }
});
