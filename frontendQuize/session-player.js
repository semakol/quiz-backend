class PlayerSessionManager {
    constructor() {
        this.sessionUrl = this.getSessionUrlFromQuery();
        this.sessionId = null; 
        this.websocket = null;
        this.currentQuestion = null;
        this.playerScore = 0;
        this.selectedAnswer = null;
        this.timerInterval = null;
        this.timeLeft = 0;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; 
        this.reconnectTimer = null;
        this.isManualClose = false; 
        this.answerSubmitted = false; 
        this.players = []; 
        // WebRTC
        this.peerConnection = null;
        this.remoteStream = null;
        this.pendingAnswer = null;
        this.offerWaitTimeout = null;
        this.pendingIceCandidates = []; // Буфер для ICE-кандидатов до setRemoteDescription
        this.isPlayingVideo = false; // Флаг для отслеживания попытки воспроизведения
        
        if (!this.sessionUrl) {
            this.showError('URL сессии не указан. Используйте формат: ?url=session-url');
            return;
        }

        // Устанавливаем темный фон для страницы игрока
        this.setDarkBackground();
        this.initAudioToggle();
        this.init();
    }

    initAudioToggle() {
        const toggleButton = document.getElementById('toggle-audio-button');
        const videoElement = document.getElementById('webrtc-background-video');
        const mutedIcon = document.getElementById('audio-icon-muted');
        const unmutedIcon = document.getElementById('audio-icon-unmuted');

        if (!toggleButton || !videoElement) return;

        // Обновляем иконку в зависимости от состояния muted
        const updateIcon = () => {
            if (videoElement.muted) {
                mutedIcon.style.display = 'block';
                unmutedIcon.style.display = 'none';
            } else {
                mutedIcon.style.display = 'none';
                unmutedIcon.style.display = 'block';
            }
        };

        // Инициализируем иконку
        updateIcon();

        // Обработчик клика
        toggleButton.addEventListener('click', () => {
            videoElement.muted = !videoElement.muted;
            updateIcon();
        });

        // Следим за изменениями muted (на случай, если оно меняется программно)
        const observer = new MutationObserver(() => {
            updateIcon();
        });
        observer.observe(videoElement, {
            attributes: true,
            attributeFilter: ['muted']
        });
    }

    setDarkBackground() {
        // Устанавливаем темный фон для body и html
        document.body.style.backgroundColor = '#000';
        document.documentElement.style.backgroundColor = '#000';
        
        // Убираем белый фон у страницы
        const pageElement = document.querySelector('.page--player');
        if (pageElement) {
            pageElement.style.backgroundColor = 'transparent';
        }
    }

    getSessionUrlFromQuery() {
        const params = new URLSearchParams(window.location.search);
        return params.get('url') || null;
    }

    async init() {
        
        const token = getAccessToken();
        if (!token) {
            this.showError('Требуется авторизация');
            window.location.href = 'login.html';
            return;
        }

        
        await this.connectWebSocket();
    }

    async connectWebSocket() {
        try {
            
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                console.log('WebSocket уже подключен');
                return;
            }

            
            if (this.websocket) {
                this.websocket.close();
            }

            const token = getAccessToken();
            if (!token) {
                throw new Error('Токен авторизации не найден');
            }

            
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsUrl;
            
            if (window.location.hostname === 'localhost' && window.location.port === '8080') {
                wsUrl = `${wsProtocol}//${window.location.host}/api/ws/${this.sessionUrl}?token=${encodeURIComponent(token)}`;
            } else {
                const wsHost = `${window.location.hostname}:8000`;
                wsUrl = `${wsProtocol}//${wsHost}/api/ws/${this.sessionUrl}?token=${encodeURIComponent(token)}`;
            }
            
            console.log('Подключение к WebSocket:', wsUrl);
            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log('WebSocket подключен');
                this.isConnected = true;
                this.reconnectAttempts = 0; 
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                
                this.updateWaitingMessage('Подключение к сессии...');
                
                // Регистрируемся как зритель WebRTC
                this.websocket.send(JSON.stringify({
                    type: 'webrtc_register_viewer',
                    session_url: this.sessionUrl
                }));
                
                // Если есть сохранённый answer, отправляем его
                if (this.pendingAnswer) {
                    setTimeout(() => {
                        if (this.websocket && this.isConnected) {
                            this.websocket.send(JSON.stringify({
                                type: 'webrtc_answer',
                                answer: this.pendingAnswer
                            }));
                            console.log('Отправлен сохранённый answer после переподключения');
                            this.pendingAnswer = null;
                        }
                    }, 500);
                }
            };

            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                // Логируем только важные сообщения
                if (message.type === 'error' || message.type === 'webrtc_offer') {
                    console.log('Получено сообщение:', message.type);
                }
                this.handleWebSocketMessage(message);
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket ошибка:', error);
                this.showError('Ошибка подключения к сессии');
            };

            this.websocket.onclose = (event) => {
                console.log('WebSocket отключен', event.code, event.reason);
                this.isConnected = false;
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                }
                
                // Отменяем таймер ожидания offer
                if (this.offerWaitTimeout) {
                    clearTimeout(this.offerWaitTimeout);
                    this.offerWaitTimeout = null;
                }
                
                // Закрываем WebRTC соединение
                if (this.peerConnection) {
                    try {
                        this.peerConnection.close();
                        this.peerConnection = null;
                    } catch (error) {
                        console.error('Ошибка при закрытии WebRTC соединения:', error);
                    }
                }
                const videoElement = document.getElementById('webrtc-background-video');
                if (videoElement) {
                    videoElement.style.display = 'none';
                    videoElement.srcObject = null;
                }
                
                
                if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
                    this.updateWaitingMessage(`Переподключение... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    
                    
                    const delay = this.reconnectDelay * this.reconnectAttempts;
                    this.reconnectTimer = setTimeout(() => {
                        this.connectWebSocket();
                    }, delay);
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.showError('Не удалось переподключиться к сессии. Пожалуйста, обновите страницу.');
                }
            };

        } catch (error) {
            console.error('Ошибка при подключении к WebSocket:', error);
            this.showError('Не удалось подключиться к сессии');
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'session_joined':
                
                if (message.session_id) {
                    this.sessionId = message.session_id;
                }
                
                
                if (message.player_score !== undefined) {
                    this.playerScore = message.player_score || 0;
                    this.updateScore(this.playerScore);
                }
                
                
                
                if (message.session_status === 'active') {
                    
                    this.showGameScreen();
                    
                    
                    if (message.current_question_id && this.sessionId) {
                        this.loadCurrentQuestion(message.current_question_id, this.sessionId);
                    } else {
                        
                        const questionText = document.getElementById('question-text');
                        if (questionText) {
                            questionText.textContent = 'Ожидание вопроса от ведущего...';
                        }
                    }
                } else if (message.session_status === 'ended') {
                    
                    this.showResults();
                } else {
                    
                    this.updateWaitingMessage('Вы подключены к сессии. Ожидание начала игры...');
                }
                break;

            case 'game_started':
                this.showGameScreen();
                break;

            case 'question_available':
                
                const sessionIdToUse = message.session_id || this.sessionId;
                if (sessionIdToUse) {
                    
                    this.showGameScreen();
                    this.loadCurrentQuestion(message.question_id, sessionIdToUse);
                }
                break;

            case 'time_up':
                this.handleTimeUp();
                break;

            case 'answer_received':
                
                break;

            case 'answer_submitted':
                
                console.log('Ответ успешно отправлен', message);
                if (message.is_correct !== null && message.is_correct !== undefined) {
                    if (message.is_correct) {
                        
                        const pointsEarned = message.score !== null && message.score !== undefined 
                            ? message.score 
                            : (this.currentQuestion?.score !== null && this.currentQuestion?.score !== undefined 
                                ? this.currentQuestion.score 
                                : 1);
                        
                        if (message.total_score !== null && message.total_score !== undefined) {
                            this.playerScore = message.total_score;
                        } else {
                            this.playerScore = (this.playerScore || 0) + pointsEarned;
                        }
                        this.updateScore(this.playerScore);
                        this.showResult(`Правильно! +${pointsEarned} ${pointsEarned === 1 ? 'балл' : pointsEarned < 5 ? 'балла' : 'баллов'}`);
                    } else {
                        this.showResult('Неправильно');
                    }
                } else {
                    this.showResult('Ответ отправлен.');
                }
                break;

            case 'score_updated':
                if (message.user_id && message.score !== undefined) {
                    this.updateScore(message.score);
                }
                break;

            case 'players_list':
                
                if (message.players) {
                    this.players = message.players;
                    this.updatePlayersList();
                }
                break;

            case 'players_updated':
                
                this.requestPlayersList();
                break;

            case 'chat_message':
                
                if (message.username && message.text) {
                    this.addChatMessage(message.username, message.text);
                }
                break;

            case 'game_ended':
                this.showResults();
                break;

            case 'error':
                
                if (message.message && message.message.includes('уже отправили ответ')) {
                    this.answerSubmitted = true;
                    
                    const submitButtons = document.querySelectorAll('[id^="submit-"]');
                    submitButtons.forEach(btn => {
                        btn.disabled = true;
                    });
                }
                this.showError(message.message || 'Произошла ошибка');
                break;

            case 'webrtc_viewer_registered':
                console.log('WebRTC зритель зарегистрирован');
                // Ждём получения offer от источника
                console.log('Ожидание offer от источника...');
                // Если offer не пришёл в течение 3 секунд, повторно регистрируемся
                this.offerWaitTimeout = setTimeout(() => {
                    if (!this.peerConnection && this.websocket && this.isConnected) {
                        console.log('Offer не получен в течение 3 секунд, повторная регистрация...');
                        // Повторно регистрируемся как зритель
                        this.websocket.send(JSON.stringify({
                            type: 'webrtc_register_viewer',
                            session_url: this.sessionUrl
                        }));
                    }
                }, 3000);
                break;

            case 'webrtc_offer':
                // Получен offer от источника
                console.log('Получено сообщение webrtc_offer', message.offer);
                // Отменяем таймер ожидания offer
                if (this.offerWaitTimeout) {
                    clearTimeout(this.offerWaitTimeout);
                    this.offerWaitTimeout = null;
                }
                if (message.offer) {
                    this.handleWebRTCOffer(message.offer);
                } else {
                    console.error('Offer получен, но данные отсутствуют');
                }
                break;

            case 'webrtc_ice_candidate':
                // Получен ICE кандидат от источника
                this.handleWebRTCIceCandidate(message.ice_candidate);
                break;

            default:
                console.log('Неизвестный тип сообщения:', message.type);
        }
    }

    async loadCurrentQuestion(questionId, sessionId) {
        try {
            if (typeof apiService === 'undefined') {
                this.showError('API сервис недоступен');
                return;
            }

            
            const sessionIdToUse = sessionId || this.sessionId;
            if (!sessionIdToUse) {
                this.updateWaitingMessage('Ожидание начала сессии...');
                return;
            }

            
            const question = await apiService.getCurrentQuestion(sessionIdToUse);
            this.currentQuestion = question;
            this.displayQuestion(question);
        } catch (error) {
            console.error('Ошибка при загрузке вопроса:', error);
            
            if (error.status === 404) {
                this.updateWaitingMessage('Ожидание вопроса от ведущего...');
            } else {
                this.showError('Не удалось загрузить вопрос');
            }
        }
    }

    displayQuestion(question) {
        this.showGameScreen();

        
        const questionText = document.getElementById('question-text');
        if (questionText) {
            questionText.textContent = question.text || 'Вопрос без текста';
        }

        
        this.displayQuestionMedia(question);

        
        const resultDiv = document.getElementById('answer-result');
        if (resultDiv) {
            resultDiv.style.display = 'none';
        }

        
        this.selectedAnswer = null;
        this.answerSubmitted = false;

        
        const submitButtons = document.querySelectorAll('[id^="submit-"]');
        submitButtons.forEach(btn => {
            btn.disabled = false;
        });

        if (question.type === 'test') {
            this.displayTestQuestion(question);
        } else {
            this.displayOpenQuestion(question);
        }

        
        if (question.time_limit && question.time_limit > 0) {
            this.startTimer(question.time_limit);
        }
        
        
        this.checkExistingAnswer(question.id);
    }

    async displayQuestionMedia(question) {
        const mediaContainer = document.getElementById('question-media');
        if (!mediaContainer) return;

        
        mediaContainer.style.display = 'none';
        mediaContainer.innerHTML = '';

        
        if (!question.media_id) {
            return;
        }

        try {
            
            let mediaInfo = question.media;
            if (!mediaInfo && typeof apiService !== 'undefined') {
                mediaInfo = await apiService.getMedia(question.media_id);
            }

            if (!mediaInfo || !mediaInfo.uri) {
                return;
            }

            
            const mediaUrl = typeof apiService !== 'undefined' 
                ? apiService.getMediaUrl(mediaInfo.uri)
                : mediaInfo.uri;

            
            const fileName = mediaInfo.title || mediaInfo.uri;
            const fileExtension = fileName.split('.').pop()?.toLowerCase();

            let mediaHTML = '';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension)) {
                
                mediaHTML = `<img src="${mediaUrl}" alt="${fileName}" class="player-question-media__image">`;
            } else if (['mp4', 'webm', 'ogg'].includes(fileExtension)) {
                
                mediaHTML = `<video src="${mediaUrl}" controls class="player-question-media__video"></video>`;
            } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension)) {
                
                mediaHTML = `<audio src="${mediaUrl}" controls class="player-question-media__audio"></audio>`;
            } else {
                
                mediaHTML = `<a href="${mediaUrl}" target="_blank" class="player-question-media__link">${fileName}</a>`;
            }

            mediaContainer.innerHTML = mediaHTML;
            mediaContainer.style.display = 'block';
        } catch (error) {
            console.error('Ошибка при загрузке медиа:', error);
            
        }
    }
    
    async checkExistingAnswer(questionId) {
        
        
        if (!this.sessionId || !questionId) return;
        
        try {
            
            
            const resultDiv = document.getElementById('answer-result');
            if (resultDiv && resultDiv.style.display === 'block') {
                
                const submitButtons = document.querySelectorAll('[id^="submit-"]');
                submitButtons.forEach(btn => {
                    btn.disabled = true;
                });
            }
        } catch (error) {
            console.error('Ошибка при проверке существующего ответа:', error);
        }
    }

    displayTestQuestion(question) {
        
        const testAnswers = document.getElementById('test-answers');
        const testActions = document.getElementById('test-answer-actions');
        const openAnswer = document.getElementById('open-answer');

        if (testAnswers) {
            testAnswers.style.display = 'block';
            testAnswers.innerHTML = '';

            const answers = question.answers || [];
            answers.forEach((answer, index) => {
                const answerDiv = document.createElement('div');
                answerDiv.className = 'player-answer-item';
                answerDiv.dataset.answerId = answer.id;
                answerDiv.dataset.isCorrect = answer.is_correct;

                answerDiv.innerHTML = `
                    <input type="radio" name="answer" id="answer-${index}" value="${answer.id}" class="player-answer-item__radio">
                    <label for="answer-${index}" class="player-answer-item__label">${answer.text || ''}</label>
                `;

                answerDiv.addEventListener('click', () => {
                    this.selectedAnswer = answer.id;
                    
                    testAnswers.querySelectorAll('.player-answer-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    answerDiv.classList.add('selected');
                    const radio = answerDiv.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                    }
                });

                testAnswers.appendChild(answerDiv);
            });
        }

        if (testActions) {
            testActions.style.display = 'block';
        }

        if (openAnswer) {
            openAnswer.style.display = 'none';
        }
    }

    displayOpenQuestion(question) {
        
        const openAnswer = document.getElementById('open-answer');
        const testAnswers = document.getElementById('test-answers');
        const testActions = document.getElementById('test-answer-actions');

        if (openAnswer) {
            openAnswer.style.display = 'block';
            const input = document.getElementById('open-answer-input');
            if (input) {
                input.value = '';
            }
        }

        if (testAnswers) {
            testAnswers.style.display = 'none';
        }

        if (testActions) {
            testActions.style.display = 'none';
        }
    }

    startTimer(seconds) {
        this.timeLeft = seconds;
        const timerValue = document.getElementById('timer-value');
        const timerContainer = document.getElementById('timer-container');

        if (timerContainer) {
            timerContainer.style.display = 'block';
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            if (timerValue) {
                timerValue.textContent = this.timeLeft;
            }

            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.handleTimeUp();
            }
        }, 1000);
    }

    handleTimeUp() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        const timerContainer = document.getElementById('timer-container');
        if (timerContainer) {
            timerContainer.style.display = 'none';
        }

        
        const submitButtons = document.querySelectorAll('[id^="submit-"]');
        submitButtons.forEach(btn => {
            btn.disabled = true;
        });
    }

    submitAnswer() {
        
        if (this.answerSubmitted) {
            alert('Вы уже отправили ответ на этот вопрос');
            return;
        }

        if (!this.currentQuestion || !this.websocket || !this.isConnected) {
            this.showError('Не удалось отправить ответ. Проверьте подключение.');
            console.error('WebSocket состояние:', {
                hasQuestion: !!this.currentQuestion,
                hasWebSocket: !!this.websocket,
                isConnected: this.isConnected,
                readyState: this.websocket?.readyState
            });
            return;
        }

        
        if (this.websocket.readyState !== WebSocket.OPEN) {
            this.showError('Соединение разорвано. Попытка переподключения...');
            this.isManualClose = false;
            this.reconnectAttempts = 0;
            this.connectWebSocket();
            return;
        }

        let answerData = {};

        if (this.currentQuestion.type === 'test') {
            if (!this.selectedAnswer) {
                alert('Выберите вариант ответа');
                return;
            }
            answerData = {
                type: 'submit_answer',
                question_id: this.currentQuestion.id,
                answer_id: parseInt(this.selectedAnswer)
            };
        } else {
            const openInput = document.getElementById('open-answer-input');
            if (!openInput || !openInput.value.trim()) {
                alert('Введите ответ');
                return;
            }
            answerData = {
                type: 'submit_answer',
                question_id: this.currentQuestion.id,
                text_answer: openInput.value.trim()
            };
        }

        try {
            console.log('Отправка ответа:', answerData);
            this.websocket.send(JSON.stringify(answerData));

            
            this.answerSubmitted = true;

            
            const submitButtons = document.querySelectorAll('[id^="submit-"]');
            submitButtons.forEach(btn => {
                btn.disabled = true;
            });
        } catch (error) {
            console.error('Ошибка при отправке ответа:', error);
            this.showError('Не удалось отправить ответ. Попробуйте еще раз.');
        }
    }

    updateScore(score) {
        this.playerScore = score;
        const scoreElement = document.getElementById('player-score');
        if (scoreElement) {
            scoreElement.textContent = score;
        }
    }

    showGameScreen() {
        const waitingScreen = document.getElementById('waiting-screen');
        const gameScreen = document.getElementById('game-screen');
        const resultsScreen = document.getElementById('results-screen');

        if (waitingScreen) {
            waitingScreen.style.display = 'none';
        }
        if (gameScreen) {
            gameScreen.style.display = 'block';
        }
        if (resultsScreen) {
            resultsScreen.style.display = 'none';
        }
    }

    showResult(message) {
        const resultDiv = document.getElementById('answer-result');
        const resultMessage = document.getElementById('result-message');
        
        if (resultDiv && resultMessage) {
            resultMessage.textContent = message;
            resultDiv.style.display = 'block';
        }
    }

    showResults() {
        const waitingScreen = document.getElementById('waiting-screen');
        const gameScreen = document.getElementById('game-screen');
        const resultsScreen = document.getElementById('results-screen');

        if (waitingScreen) {
            waitingScreen.style.display = 'none';
        }
        if (gameScreen) {
            gameScreen.style.display = 'none';
        }
        if (resultsScreen) {
            resultsScreen.style.display = 'block';
        }

        const finalScore = document.getElementById('final-score');
        if (finalScore) {
            finalScore.textContent = this.playerScore;
        }
    }

    updateWaitingMessage(message) {
        const messageElement = document.getElementById('waiting-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    showError(message) {
        alert(message);
        const messageElement = document.getElementById('waiting-message');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.style.color = '#e74c3c';
        }
    }

    requestPlayersList() {
        if (this.websocket && this.isConnected && this.sessionId) {
            this.websocket.send(JSON.stringify({
                type: 'get_players_list',
                session_id: this.sessionId
            }));
        }
    }

    updatePlayersList() {
        const playersList = document.getElementById('player-players-list');
        if (!playersList) return;

        if (this.players.length === 0) {
            playersList.innerHTML = '<div class="player-players-empty">Пока нет подключенных игроков</div>';
            return;
        }

        playersList.innerHTML = '';
        this.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-player-item';
            playerItem.innerHTML = `
                <span class="player-player-item__name">${player.nickname || player.username || 'Игрок'}</span>
                <span class="player-player-item__score">${player.score || 0}</span>
            `;
            playersList.appendChild(playerItem);
        });
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput || !this.websocket || !this.isConnected) {
            return;
        }

        const text = chatInput.value.trim();
        if (!text) {
            return;
        }

        if (text.length > 500) {
            alert('Сообщение слишком длинное (максимум 500 символов)');
            return;
        }

        try {
            this.websocket.send(JSON.stringify({
                type: 'chat_message',
                text: text
            }));

            
            chatInput.value = '';
        } catch (error) {
            console.error('Ошибка при отправке сообщения чата:', error);
        }
    }

    addChatMessage(username, text) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        
        const emptyMessage = chatMessages.querySelector('.player-chat-empty');
        if (emptyMessage) {
            emptyMessage.remove();
        }

        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'player-chat-message';
        messageDiv.innerHTML = `
            <div class="player-chat-message__author">${this.escapeHtml(username)}</div>
            <div class="player-chat-message__text">${this.escapeHtml(text)}</div>
        `;

        chatMessages.appendChild(messageDiv);

        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // WebRTC методы
    async createPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(configuration);

        // Обработка удалённого потока
        pc.ontrack = (event) => {
            const newStream = event.streams[0] || event.stream;
            if (!newStream) {
                console.error('Поток не найден в событии!');
                return;
            }
            
            const videoElement = document.getElementById('webrtc-background-video');
            if (!videoElement) {
                console.error('Видео элемент не найден в DOM!');
                return;
            }
            
            // Проверяем, не установлен ли уже тот же поток
            if (videoElement.srcObject === newStream && this.remoteStream === newStream) {
                return; // Поток уже установлен, не делаем ничего
            }
            
            this.remoteStream = newStream;
            
            // Устанавливаем srcObject только если он отличается
            if (videoElement.srcObject !== newStream) {
                videoElement.srcObject = newStream;
            }
            
            // Устанавливаем muted для автоматического воспроизведения
            videoElement.muted = true;
            
            // Принудительно устанавливаем все стили с !important через setProperty
            videoElement.style.setProperty('display', 'block', 'important');
            videoElement.style.setProperty('opacity', '0.7', 'important');
            videoElement.style.setProperty('z-index', '0', 'important');
            videoElement.style.setProperty('position', 'fixed', 'important');
            videoElement.style.setProperty('top', '0', 'important');
            videoElement.style.setProperty('left', '0', 'important');
            videoElement.style.setProperty('width', '100%', 'important');
            videoElement.style.setProperty('height', '100%', 'important');
            videoElement.style.setProperty('object-fit', 'cover', 'important');
            videoElement.style.setProperty('pointer-events', 'none', 'important');
            
            // Убеждаемся, что body и html имеют прозрачный фон
            document.body.style.setProperty('background-color', 'transparent', 'important');
            document.documentElement.style.setProperty('background-color', 'transparent', 'important');
            
            // Убираем белый фон у страницы
            const pageElement = document.querySelector('.page--player');
            if (pageElement) {
                pageElement.style.setProperty('background-color', 'transparent', 'important');
            }
            
            // Принудительное воспроизведение (только если не идет уже попытка)
            if (!this.isPlayingVideo) {
                this.isPlayingVideo = true;
                const tryPlay = () => {
                    if (videoElement.paused && videoElement.readyState >= 2) {
                        const playPromise = videoElement.play();
                        if (playPromise !== undefined) {
                            playPromise.then(() => {
                                this.isPlayingVideo = false;
                                // Убеждаемся, что видео видно
                                const rect = videoElement.getBoundingClientRect();
                                if (rect.width === 0 || rect.height === 0) {
                                    this.ensureVideoVisible();
                                }
                            }).catch(err => {
                                // Игнорируем ошибку AbortError (прерванный запрос)
                                if (err.name !== 'AbortError') {
                                    console.error('Ошибка воспроизведения видео:', err);
                                }
                                this.isPlayingVideo = false;
                            });
                        } else {
                            this.isPlayingVideo = false;
                        }
                    } else {
                        this.isPlayingVideo = false;
                    }
                };
                
                // Используем oncanplay для воспроизведения, когда видео готово
                const handleCanPlay = () => {
                    if (videoElement.paused && !this.isPlayingVideo) {
                        this.isPlayingVideo = true;
                        videoElement.play().then(() => {
                            this.isPlayingVideo = false;
                        }).catch(err => {
                            if (err.name !== 'AbortError') {
                                console.error('Ошибка воспроизведения видео:', err);
                            }
                            this.isPlayingVideo = false;
                        });
                    }
                    videoElement.removeEventListener('canplay', handleCanPlay);
                };
                
                videoElement.addEventListener('canplay', handleCanPlay);
                
                // Если видео уже готово, пробуем сразу
                if (videoElement.readyState >= 2) {
                    tryPlay();
                }
                
                setTimeout(() => {
                    this.ensureVideoVisible();
                }, 500);
            }
            
            videoElement.onerror = (error) => {
                console.error('Ошибка видео элемента:', error);
                this.isPlayingVideo = false;
            };
        };

        // Обработка ICE кандидатов
        pc.onicecandidate = (event) => {
            if (event.candidate && this.websocket && this.isConnected && this.websocket.readyState === WebSocket.OPEN) {
                try {
                    this.websocket.send(JSON.stringify({
                        type: 'webrtc_ice_candidate',
                        ice_candidate: event.candidate
                    }));
                } catch (error) {
                    console.error('Ошибка при отправке ICE кандидата:', error);
                }
            }
        };

        // Обработка ошибок
        pc.onerror = (error) => {
            console.error('WebRTC ошибка:', error);
        };

        // Обработка закрытия соединения
        pc.onconnectionstatechange = () => {
            const videoElement = document.getElementById('webrtc-background-video');
            
            if (pc.connectionState === 'connected') {
                this.ensureVideoVisible();
            } else if (pc.connectionState === 'connecting' && this.remoteStream) {
                this.ensureVideoVisible();
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                if (videoElement) {
                    videoElement.style.display = 'none';
                }
            }
        };
        
        // Обработка изменения состояния ICE соединения
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed') {
                console.error('ICE соединение не удалось установить');
            }
        };

        return pc;
    }

    async handleWebRTCOffer(offer) {
        try {
            // Проверяем валидность offer
            if (!offer || !offer.type || offer.type !== 'offer') {
                console.error('Некорректный offer:', offer);
                return;
            }
            
            // Закрываем существующее соединение, если есть
            if (this.peerConnection) {
                try {
                    this.peerConnection.close();
                } catch (error) {
                    console.error('Ошибка при закрытии старого соединения:', error);
                }
                this.peerConnection = null;
            }
            
            // Очищаем буфер кандидатов - они относятся к старому SDP
            this.pendingIceCandidates = [];

            // Создаём новое соединение
            this.peerConnection = await this.createPeerConnection();
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Применяем только кандидаты, которые пришли после setRemoteDescription для текущего SDP
            // (они будут добавлены через handleWebRTCIceCandidate)

            // Создаём answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Отправляем answer источнику
            setTimeout(() => {
                if (this.websocket && this.isConnected && this.websocket.readyState === WebSocket.OPEN) {
                    try {
                        this.websocket.send(JSON.stringify({
                            type: 'webrtc_answer',
                            answer: answer
                        }));
                    } catch (error) {
                        console.error('Ошибка при отправке answer:', error);
                        this.pendingAnswer = answer;
                    }
                } else {
                    this.pendingAnswer = answer;
                }
            }, 200);
        } catch (error) {
            console.error('Ошибка при обработке WebRTC offer:', error);
        }
    }

    async handleWebRTCIceCandidate(candidate) {
        if (!this.peerConnection) {
            // Если соединение ещё не создано, игнорируем кандидат (он относится к старому SDP)
            return;
        }
        
        // Проверяем, установлен ли remoteDescription (текущий SDP)
        if (this.peerConnection.remoteDescription === null) {
            // Если remoteDescription ещё не установлен, буферизуем кандидат для текущего SDP
            this.pendingIceCandidates.push(candidate);
            return;
        }
        
        // Проверяем, что соединение в правильном состоянии для добавления кандидатов
        if (this.peerConnection.signalingState === 'closed' || 
            this.peerConnection.connectionState === 'closed' ||
            this.peerConnection.connectionState === 'failed') {
            // Соединение закрыто или не удалось - игнорируем кандидат
            return;
        }
        
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            // Если ошибка InvalidStateError - кандидат относится к старому SDP, игнорируем
            if (error.name === 'InvalidStateError') {
                // Игнорируем - кандидат относится к старому SDP
                return;
            } else if (error.name === 'OperationError') {
                // Временная ошибка - пробуем добавить в буфер
                this.pendingIceCandidates.push(candidate);
            } else {
                console.error('Ошибка при добавлении ICE кандидата:', error);
            }
        }
    }

    ensureVideoVisible() {
        const videoElement = document.getElementById('webrtc-background-video');
        if (videoElement && this.remoteStream) {
            // Устанавливаем srcObject только если он отличается
            if (videoElement.srcObject !== this.remoteStream) {
                videoElement.srcObject = this.remoteStream;
            }
            
            videoElement.style.setProperty('display', 'block', 'important');
            videoElement.style.setProperty('opacity', '0.7', 'important');
            videoElement.style.setProperty('z-index', '0', 'important');
            videoElement.style.setProperty('position', 'fixed', 'important');
            videoElement.style.setProperty('top', '0', 'important');
            videoElement.style.setProperty('left', '0', 'important');
            videoElement.style.setProperty('width', '100%', 'important');
            videoElement.style.setProperty('height', '100%', 'important');
            
            // Убеждаемся, что фон прозрачный
            document.body.style.setProperty('background-color', 'transparent', 'important');
            document.documentElement.style.setProperty('background-color', 'transparent', 'important');
            
            // Пробуем воспроизвести только если видео готово и не идет уже попытка
            if (!this.isPlayingVideo && videoElement.paused && videoElement.readyState >= 2) {
                this.isPlayingVideo = true;
                videoElement.play().then(() => {
                    this.isPlayingVideo = false;
                }).catch(err => {
                    // Игнорируем ошибку AbortError (прерванный запрос)
                    if (err.name !== 'AbortError') {
                        console.error('Ошибка при попытке воспроизведения:', err);
                    }
                    this.isPlayingVideo = false;
                });
            }
        }
    }
}


document.addEventListener('DOMContentLoaded', function() {
    window.playerSession = new PlayerSessionManager();

    
    const submitOpenAnswer = document.getElementById('submit-open-answer');
    if (submitOpenAnswer) {
        submitOpenAnswer.addEventListener('click', () => {
            if (window.playerSession) {
                window.playerSession.submitAnswer();
            }
        });
    }

    const submitTestAnswer = document.getElementById('submit-test-answer');
    if (submitTestAnswer) {
        submitTestAnswer.addEventListener('click', () => {
            if (window.playerSession) {
                window.playerSession.submitAnswer();
            }
        });
    }

    
    const chatSendButton = document.getElementById('chat-send');
    const chatInput = document.getElementById('chat-input');
    
    if (chatSendButton) {
        chatSendButton.addEventListener('click', () => {
            if (window.playerSession) {
                window.playerSession.sendChatMessage();
            }
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (window.playerSession) {
                    window.playerSession.sendChatMessage();
                }
            }
        });
    }
});


window.addEventListener('beforeunload', function() {
    if (window.playerSession) {
        
        window.playerSession.isManualClose = true;
        
        
        if (window.playerSession.websocket) {
            window.playerSession.websocket.close();
        }
        
        
        if (window.playerSession.timerInterval) {
            clearInterval(window.playerSession.timerInterval);
        }
        
        
        if (window.playerSession.reconnectTimer) {
            clearTimeout(window.playerSession.reconnectTimer);
        }
    }
});


document.addEventListener('visibilitychange', function() {
    if (window.playerSession && !document.hidden) {
        
        if (!window.playerSession.isConnected && window.playerSession.sessionUrl) {
            console.log('Страница снова видна, проверяем соединение...');
            
            window.playerSession.isManualClose = false;
            window.playerSession.reconnectAttempts = 0;
            window.playerSession.connectWebSocket();
        }
    }
});

