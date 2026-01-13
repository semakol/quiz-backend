class SessionManager {
    constructor() {
        this.sessionId = this.getSessionIdFromUrl();
        this.session = null;
        this.sessionUrl = null;
        this.currentQuestion = null;
        this.players = [];
        this.websocket = null;
        this.isConnected = false;
        // WebRTC
        this.localStream = null;
        this.peerConnections = new Map(); // viewer_id -> RTCPeerConnection
        this.isStreaming = false;
        this.cameraEnabled = true;
        this.microphoneEnabled = true;
        this.init();
    }

    getSessionIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') || null;
    }

    async init() {
        if (!this.sessionId) {
            alert('ID сессии не указан');
            window.location.href = 'index.html';
            return;
        }

        this.setupEventListeners();
        
        await this.loadSessionForUrl();
        
        if (this.sessionUrl) {
            await this.connectWebSocket();
            
            this.startPolling();
        }
    }

    setupEventListeners() {
        
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        
        const copyUrlButton = document.getElementById('copy-url-button');
        if (copyUrlButton) {
            copyUrlButton.addEventListener('click', () => this.copySessionUrl());
        }

        
        const startButton = document.getElementById('start-button');
        if (startButton) {
            startButton.addEventListener('click', () => this.startSession());
        }

        const nextQuestionButton = document.getElementById('next-question-button');
        if (nextQuestionButton) {
            nextQuestionButton.addEventListener('click', () => this.nextQuestion());
        }

        const endButton = document.getElementById('end-button');
        if (endButton) {
            endButton.addEventListener('click', () => this.endSession());
        }

        // WebRTC controls
        const startStreamButton = document.getElementById('start-stream-button');
        if (startStreamButton) {
            startStreamButton.addEventListener('click', () => this.startWebRTCStream());
        }

        const stopStreamButton = document.getElementById('stop-stream-button');
        if (stopStreamButton) {
            stopStreamButton.addEventListener('click', () => this.stopWebRTCStream());
        }

        const toggleCameraButton = document.getElementById('toggle-camera-button');
        if (toggleCameraButton) {
            toggleCameraButton.addEventListener('click', () => this.toggleCamera());
        }

        const toggleMicrophoneButton = document.getElementById('toggle-microphone-button');
        if (toggleMicrophoneButton) {
            toggleMicrophoneButton.addEventListener('click', () => this.toggleMicrophone());
        }
    }

    async loadSessionForUrl() {
        try {
            if (typeof apiService === 'undefined') {
                console.error('API сервис недоступен');
                return;
            }

            
            this.session = await apiService.getSession(this.sessionId);
            this.sessionUrl = this.session.url;
            this.updateUI();
            
            
            await this.loadCurrentQuestion();
        } catch (error) {
            console.error('Ошибка при загрузке сессии:', error);
            alert('Не удалось загрузить сессию. Попробуйте позже.');
        }
    }

    async loadCurrentQuestion() {
        try {
            this.currentQuestion = await apiService.getCurrentQuestion(this.sessionId);
            this.updateQuestionUI();
        } catch (error) {
            
            if (error.status !== 404) {
                console.error('Ошибка при загрузке текущего вопроса:', error);
            }
        }
    }

    async connectWebSocket() {
        try {
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
                
                this.requestSessionInfo();
                this.requestPlayersList();
                
                // Проверяем, была ли активная трансляция до перезагрузки
                const wasStreaming = sessionStorage.getItem(`streaming_${this.sessionUrl}`);
                if (wasStreaming === 'true') {
                    console.log('Обнаружена активная трансляция до перезагрузки');
                    // Автоматически восстанавливаем трансляцию после небольшой задержки
                    setTimeout(() => {
                        console.log('Автоматическое восстановление трансляции...');
                        // Не показываем диалог, просто восстанавливаем
                        // Пользователь может остановить трансляцию вручную, если нужно
                        this.startWebRTCStream();
                    }, 1500);
                }
            };

            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket ошибка:', error);
            };

            this.websocket.onclose = () => {
                console.log('WebSocket отключен');
                this.isConnected = false;
            };

        } catch (error) {
            console.error('Ошибка при подключении к WebSocket:', error);
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'session_joined':
                
                if (message.session_id) {
                    this.sessionId = message.session_id;
                }
                break;

            case 'session_info':
                
                if (message.session) {
                    this.session = message.session;
                    this.updateUI();
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

            case 'question_available':
                
                if (message.session_id) {
                    this.loadCurrentQuestion();
                }
                break;

            case 'question_sent':
                
                alert('Следующий вопрос отправлен игрокам!');
                break;

            case 'game_started':
                
                if (this.session) {
                    this.session.status = 'active';
                    this.updateUI();
                }
                break;

            case 'game_paused':
                
                if (this.session) {
                    this.session.status = 'paused';
                    this.updateUI();
                }
                break;

            case 'game_ended':
                
                if (this.session) {
                    this.session.status = 'ended';
                    this.updateUI();
                }
                alert('Сессия завершена');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                break;

            case 'status_updated':
                
                if (this.session && message.status) {
                    this.session.status = message.status;
                    this.updateUI();
                }
                break;

            case 'webrtc_host_registered':
                // Если была активная трансляция, перезапускаем её
                if (this.isStreaming && this.localStream) {
                    setTimeout(() => {
                        this.sendWebRTCOfferToViewers();
                    }, 500);
                }
                break;

            case 'webrtc_viewer_connected':
                // Новый зритель подключился - пересоздаём offer
                if (this.isStreaming && this.localStream) {
                    // Закрываем старое соединение и создаём новое
                    const oldPc = this.peerConnections.get('broadcast');
                    if (oldPc) {
                        try {
                            oldPc.close();
                        } catch (error) {
                            console.error('Ошибка при закрытии старого соединения:', error);
                        }
                        this.peerConnections.delete('broadcast');
                    }
                    // Пересоздаём offer для всех зрителей
                    setTimeout(() => {
                        this.sendWebRTCOfferToViewers();
                    }, 300);
                }
                break;

            case 'webrtc_answer':
                // Получен answer от зрителя
                this.handleWebRTCAnswer(message.answer, message.viewer_id);
                break;

            case 'webrtc_ice_candidate':
                // Получен ICE кандидат от зрителя
                this.handleWebRTCIceCandidate(message.ice_candidate, message.viewer_id);
                break;

            default:
                console.log('Неизвестный тип сообщения:', message.type);
        }
    }

    requestSessionInfo() {
        if (this.websocket && this.isConnected) {
            this.websocket.send(JSON.stringify({
                type: 'get_session_info',
                session_id: this.sessionId
            }));
        }
    }

    requestPlayersList() {
        if (this.websocket && this.isConnected) {
            this.websocket.send(JSON.stringify({
                type: 'get_players_list',
                session_id: this.sessionId
            }));
        }
    }

    updatePlayersList() {
        const playersList = document.getElementById('players-list');
        const playersCount = document.getElementById('players-count');
        
        if (playersCount) {
            playersCount.textContent = this.players.length;
        }

        if (!playersList) return;

        if (this.players.length === 0) {
            playersList.innerHTML = '<div class="session-players-empty">Пока нет подключенных игроков</div>';
            return;
        }

        playersList.innerHTML = '';
        this.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'session-player-item';
            playerItem.innerHTML = `
                <span class="session-player-item__name">${player.nickname || player.username || 'Игрок'}</span>
                <span class="session-player-item__score">${player.score || 0}</span>
            `;
            playersList.appendChild(playerItem);
        });
    }

    updateUI() {
        if (!this.session) return;

        
        const titleElement = document.getElementById('session-title');
        if (titleElement) {
            titleElement.textContent = `Сессия #${this.session.id}`;
        }

        
        const urlElement = document.getElementById('session-url');
        if (urlElement) {
            const fullUrl = `${window.location.origin}${window.location.pathname.replace('session.html', 'session-player.html')}?url=${encodeURIComponent(this.session.url)}`;
            urlElement.textContent = this.session.url;
            urlElement.dataset.fullUrl = fullUrl;
        }

        
        const quizNameElement = document.getElementById('quiz-name');
        if (quizNameElement) {
            quizNameElement.textContent = `Квиз #${this.session.quiz_id}`;
        }

        
        const createdElement = document.getElementById('session-created');
        if (createdElement && this.session.started_at) {
            const date = new Date(this.session.started_at);
            createdElement.textContent = date.toLocaleString('ru-RU');
        }

        
        const statusElement = document.getElementById('status-value');
        if (statusElement) {
            statusElement.textContent = this.getStatusText(this.session.status);
            statusElement.className = `session-header__status-value session-header__status-value--${this.session.status}`;
        }

        
        this.updateControlButtons();
    }

    updateQuestionUI() {
        if (!this.currentQuestion) {
            const questionCard = document.getElementById('question-card');
            if (questionCard) {
                questionCard.style.display = 'none';
            }
            return;
        }

        const questionCard = document.getElementById('question-card');
        if (questionCard) {
            questionCard.style.display = 'block';
        }

        const questionText = document.getElementById('question-text');
        if (questionText) {
            questionText.textContent = this.currentQuestion.text || 'Вопрос без текста';
        }

        
        this.displayQuestionMedia(this.currentQuestion);

        const questionInfo = document.getElementById('question-info');
        if (questionInfo) {
            const timeLimit = this.currentQuestion.time_limit || 0;
            questionInfo.innerHTML = `
                <div class="session-question-info-item">
                    <span>Время на ответ: ${timeLimit} сек</span>
                </div>
            `;
        }
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
                
                mediaHTML = `<img src="${mediaUrl}" alt="${fileName}" class="session-question-media__image">`;
            } else if (['mp4', 'webm', 'ogg'].includes(fileExtension)) {
                
                mediaHTML = `<video src="${mediaUrl}" controls class="session-question-media__video"></video>`;
            } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension)) {
                
                mediaHTML = `<audio src="${mediaUrl}" controls class="session-question-media__audio"></audio>`;
            } else {
                
                mediaHTML = `<a href="${mediaUrl}" target="_blank" class="session-question-media__link">${fileName}</a>`;
            }

            mediaContainer.innerHTML = mediaHTML;
            mediaContainer.style.display = 'block';
        } catch (error) {
            console.error('Ошибка при загрузке медиа:', error);
            
        }
    }

    updateControlButtons() {
        if (!this.session) return;

        const status = this.session.status;
        const startButton = document.getElementById('start-button');
        const nextQuestionButton = document.getElementById('next-question-button');

        
        if (startButton) {
            startButton.disabled = status !== 'waiting';
        }

        
        if (nextQuestionButton) {
            nextQuestionButton.disabled = status !== 'active';
        }
    }

    getStatusText(status) {
        const statusMap = {
            'waiting': 'Ожидание',
            'active': 'Активна',
            'paused': 'Приостановлена',
            'ended': 'Завершена'
        };
        return statusMap[status] || status;
    }

    async startSession() {
        if (!this.websocket || !this.isConnected) {
            alert('WebSocket не подключен');
            return;
        }

        try {
            this.websocket.send(JSON.stringify({
                type: 'start_game',
                session_id: this.sessionId
            }));
            alert('Игра начата!');
        } catch (error) {
            console.error('Ошибка при запуске сессии:', error);
            alert('Не удалось запустить игру. Попробуйте еще раз.');
        }
    }

    async nextQuestion() {
        if (!this.websocket || !this.isConnected) {
            alert('WebSocket не подключен');
            return;
        }

        try {
            
            this.websocket.send(JSON.stringify({
                type: 'next_question',
                session_id: this.sessionId
            }));
            
            
        } catch (error) {
            console.error('Ошибка при переходе к следующему вопросу:', error);
            alert('Не удалось перейти к следующему вопросу. Попробуйте еще раз.');
        }
    }

    async endSession() {
        if (!confirm('Вы уверены, что хотите завершить сессию?')) {
            return;
        }

        if (!this.websocket || !this.isConnected) {
            alert('WebSocket не подключен');
            return;
        }

        try {
            this.websocket.send(JSON.stringify({
                type: 'end_game',
                session_id: this.sessionId
            }));
            
        } catch (error) {
            console.error('Ошибка при завершении сессии:', error);
            alert('Не удалось завершить сессию. Попробуйте еще раз.');
        }
    }

    copySessionUrl() {
        const urlElement = document.getElementById('session-url');
        if (!urlElement) return;

        const fullUrl = urlElement.dataset.fullUrl || urlElement.textContent;
        
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            
            navigator.clipboard.writeText(fullUrl).then(() => {
                alert('Ссылка скопирована в буфер обмена!');
            }).catch(err => {
                console.error('Ошибка при копировании:', err);
                this.fallbackCopyTextToClipboard(fullUrl);
            });
        } else {
            
            this.fallbackCopyTextToClipboard(fullUrl);
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('Ссылка скопирована в буфер обмена!');
            } else {
                prompt('Скопируйте ссылку:', text);
            }
        } catch (err) {
            console.error('Ошибка при копировании:', err);
            prompt('Скопируйте ссылку:', text);
        }
        
        document.body.removeChild(textArea);
    }

    
    startPolling() {
        
        this.pollInterval = setInterval(() => {
            if (this.websocket && this.isConnected) {
                this.requestSessionInfo();
                this.requestPlayersList();
            }
        }, 5000);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
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

        
        const emptyMessage = chatMessages.querySelector('.session-chat-empty');
        if (emptyMessage) {
            emptyMessage.remove();
        }

        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'session-chat-message';
        messageDiv.innerHTML = `
            <div class="session-chat-message__author">${this.escapeHtml(username)}</div>
            <div class="session-chat-message__text">${this.escapeHtml(text)}</div>
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
    async startWebRTCStream() {
        try {
            // Проверяем, не запущена ли уже трансляция
            if (this.isStreaming && this.localStream) {
                console.warn('Трансляция уже запущена');
                return;
            }
            
            // Останавливаем предыдущий поток, если есть
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }
            
            // Запрашиваем доступ к камере
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: 'user' // Передняя камера
                },
                audio: true
            });

            this.localStream = stream;
            this.isStreaming = true;
            
            // Сохраняем состояние трансляции
            sessionStorage.setItem(`streaming_${this.sessionUrl}`, 'true');

            // Отображаем локальный поток
            const videoElement = document.getElementById('host-video');
            const placeholder = document.getElementById('host-video-placeholder');
            if (videoElement) {
                videoElement.srcObject = stream;
                videoElement.style.display = 'block';
            }
            if (placeholder) {
                placeholder.style.display = 'none';
            }

            // Обновляем UI
            const startButton = document.getElementById('start-stream-button');
            const stopButton = document.getElementById('stop-stream-button');
            const toggleCameraButton = document.getElementById('toggle-camera-button');
            const toggleMicrophoneButton = document.getElementById('toggle-microphone-button');
            
            if (startButton) startButton.style.display = 'none';
            if (stopButton) stopButton.style.display = 'block';
            if (toggleCameraButton) toggleCameraButton.style.display = 'block';
            if (toggleMicrophoneButton) toggleMicrophoneButton.style.display = 'block';

            // Регистрируемся как источник
            if (this.websocket && this.isConnected) {
                this.websocket.send(JSON.stringify({
                    type: 'webrtc_register_host',
                    session_url: this.sessionUrl
                }));
                
                // Отправляем offer после небольшой задержки
                setTimeout(() => {
                    this.sendWebRTCOfferToViewers();
                }, 1000);
            }

            // Обрабатываем отключение потока
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    if (this.isStreaming) {
                        this.stopWebRTCStream();
                    }
                };
            });

        } catch (error) {
            console.error('Ошибка при запуске трансляции:', error);
            alert('Не удалось начать трансляцию. Проверьте разрешения на доступ к камере и микрофону.');
        }
    }

    async stopWebRTCStream() {
        // Останавливаем все треки
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Закрываем все peer connections
        this.peerConnections.forEach((pc, viewerId) => {
            try {
                pc.close();
            } catch (error) {
                console.error('Ошибка при закрытии peer connection:', error);
            }
        });
        this.peerConnections.clear();

        this.isStreaming = false;
        
        // Удаляем состояние трансляции
        sessionStorage.removeItem(`streaming_${this.sessionUrl}`);

        // Обновляем UI
        const videoElement = document.getElementById('host-video');
        const placeholder = document.getElementById('host-video-placeholder');
        if (videoElement) {
            videoElement.srcObject = null;
            videoElement.style.display = 'none';
        }
        if (placeholder) {
            placeholder.style.display = 'block';
        }

        const startButton = document.getElementById('start-stream-button');
        const stopButton = document.getElementById('stop-stream-button');
        const toggleCameraButton = document.getElementById('toggle-camera-button');
        const toggleMicrophoneButton = document.getElementById('toggle-microphone-button');
        
        if (startButton) startButton.style.display = 'block';
        if (stopButton) stopButton.style.display = 'none';
        if (toggleCameraButton) toggleCameraButton.style.display = 'none';
        if (toggleMicrophoneButton) toggleMicrophoneButton.style.display = 'none';
    }

    toggleCamera() {
        if (!this.localStream) return;

        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
            track.enabled = !track.enabled;
            this.cameraEnabled = track.enabled;
        });

        const button = document.getElementById('toggle-camera-button');
        if (button) {
            const text = button.querySelector('.session-stream-controls__button-text');
            if (text) {
                text.textContent = this.cameraEnabled ? 'Выключить камеру' : 'Включить камеру';
            }
        }
    }

    toggleMicrophone() {
        if (!this.localStream) return;

        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
            this.microphoneEnabled = track.enabled;
        });

        const button = document.getElementById('toggle-microphone-button');
        if (button) {
            const text = button.querySelector('.session-stream-controls__button-text');
            if (text) {
                text.textContent = this.microphoneEnabled ? 'Выключить микрофон' : 'Включить микрофон';
            }
        }
    }

    async createPeerConnectionForViewer(viewerId) {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(configuration);

        // Добавляем локальные треки
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

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

        // Обработка состояния соединения
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed') {
                console.error('WebRTC соединение не удалось установить');
            }
        };

        return pc;
    }

    async handleWebRTCAnswer(answer, viewerId) {
        const pc = this.peerConnections.get('broadcast');
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error('Ошибка при установке remote description для answer:', error);
            }
        }
    }

    async handleWebRTCIceCandidate(candidate, viewerId) {
        const pc = this.peerConnections.get('broadcast');
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Ошибка при добавлении ICE кандидата:', error);
            }
        }
    }

    async sendWebRTCOfferToViewers() {
        if (!this.localStream || !this.isStreaming) return;

        // Создаем одно соединение для трансляции всем зрителям
        // В реальном приложении нужен SFU для масштабирования
        const viewerId = 'broadcast';
        
        if (!this.peerConnections.has(viewerId)) {
            const pc = await this.createPeerConnectionForViewer(viewerId);
            this.peerConnections.set(viewerId, pc);

            const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            await pc.setLocalDescription(offer);

            if (this.websocket && this.isConnected) {
                this.websocket.send(JSON.stringify({
                    type: 'webrtc_offer',
                    offer: offer
                }));
            }
        }
    }
}


document.addEventListener('DOMContentLoaded', function() {
    window.sessionManager = new SessionManager();

    
    const chatSendButton = document.getElementById('chat-send');
    const chatInput = document.getElementById('chat-input');
    
    if (chatSendButton) {
        chatSendButton.addEventListener('click', () => {
            if (window.sessionManager) {
                window.sessionManager.sendChatMessage();
            }
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (window.sessionManager) {
                    window.sessionManager.sendChatMessage();
                }
            }
        });
    }
});


window.addEventListener('beforeunload', function() {
    if (window.sessionManager) {
        window.sessionManager.stopPolling();
    }
});

