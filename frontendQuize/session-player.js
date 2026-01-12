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
        
        if (!this.sessionUrl) {
            this.showError('URL сессии не указан. Используйте формат: ?url=session-url');
            return;
        }

        this.init();
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
            };

            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
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
        console.log('Получено сообщение:', message);

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

