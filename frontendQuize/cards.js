class CardManager {
    constructor() {
        this.broadcastsContainer = document.querySelector('[data-tab-content="broadcasts"]');
        this.quizzesContainer = document.querySelector('[data-tab-content="quizzes"]');
        this.statisticsContainer = document.querySelector('[data-tab-content="statistics"]');
        this.broadcastsStorageKey = 'broadcasts';
        this.loadedQuizzes = []; 
    }

    

    getStoredBroadcasts() {
        try {
            const raw = localStorage.getItem(this.broadcastsStorageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Не удалось прочитать сохранённые трансляции из localStorage', e);
            return [];
        }
    }

    saveStoredBroadcasts(list) {
        try {
            localStorage.setItem(this.broadcastsStorageKey, JSON.stringify(list));
        } catch (e) {
            console.error('Не удалось сохранить трансляции в localStorage', e);
        }
    }

    
    createBroadcastCard(sessionData) {
        const card = document.createElement('article');
        card.className = 'broadcast-card';
        card.dataset.id = sessionData.id || Date.now();
        card.dataset.sessionId = sessionData.id;

        const date = sessionData.started_at ? this.formatDate(sessionData.started_at) : 'Не указана';
        const status = sessionData.status || 'waiting';
        const statusText = this.getStatusText(status);
        const title = `Сессия #${sessionData.id}`;

        card.innerHTML = `
            <div class="broadcast-card__bg"></div>
            <button class="broadcast-card__close" aria-label="Закрыть карточку" data-card-id="${card.dataset.id}">
                <img src="img/close-icon.svg" alt="" class="broadcast-card__close-icon">
            </button>
            
            <div class="broadcast-card__play-wrapper">
                <div class="broadcast-card__play-icon">
                    <img src="img/play-icon.svg" alt="" class="broadcast-card__play-triangle">
                </div>
            </div>

            <h3 class="broadcast-card__title">${title}</h3>
            <p class="broadcast-card__date">${date}</p>
            <p class="broadcast-card__description">Статус: ${statusText}</p>

            <div class="broadcast-card__pattern">
                <img src="img/card-pattern.svg" alt="" class="broadcast-card__pattern-image">
            </div>

            <div class="broadcast-card__actions">
                <button class="button button--primary" data-action="open-session" data-session-id="${sessionData.id}">Открыть сессию</button>
            </div>
        `;

        
        const closeBtn = card.querySelector('.broadcast-card__close');
        closeBtn.addEventListener('click', () => this.deleteBroadcastCard(card.dataset.id));

        return card;
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

    
    createStatisticsCard(sessionData) {
        const card = document.createElement('article');
        card.className = 'broadcast-card';
        card.dataset.id = sessionData.id || Date.now();
        card.dataset.sessionId = sessionData.id;

        const date = sessionData.ended_at ? this.formatDate(sessionData.ended_at) : (sessionData.started_at ? this.formatDate(sessionData.started_at) : 'Не указана');
        const title = `Сессия #${sessionData.id}`;
        const description = `Завершена: ${date}`;

        card.innerHTML = `
            <div class="broadcast-card__bg"></div>
            <button class="broadcast-card__close" aria-label="Закрыть карточку" data-card-id="${card.dataset.id}">
                <img src="img/close-icon.svg" alt="" class="broadcast-card__close-icon">
            </button>
            
            <div class="broadcast-card__play-wrapper">
                <img src="img/statistics.svg" alt="" class="statistics-card__icon">
            </div>

            <h3 class="broadcast-card__title">${title}</h3>
            <p class="broadcast-card__date">${date}</p>
            <p class="broadcast-card__description">${description}</p>

            <div class="broadcast-card__pattern">
                <img src="img/card-pattern.svg" alt="" class="broadcast-card__pattern-image">
            </div>

            <div class="broadcast-card__actions">
                <button class="button button--primary button--export" data-action="export-csv" data-session-id="${sessionData.id}">Выгрузить в формате CSV</button>
            </div>
        `;

        
        const closeBtn = card.querySelector('.broadcast-card__close');
        closeBtn.addEventListener('click', () => this.deleteStatisticsCard(card.dataset.id));

        return card;
    }

    
    createQuizCard(quizData) {
        const card = document.createElement('article');
        card.className = 'broadcast-card quiz-card';
        card.dataset.id = quizData.id || Date.now();

        const questionCount = quizData.questionCount || 0;
        const description = quizData.description || 'Описание отсутствует';

        card.innerHTML = `
            <div class="broadcast-card__bg"></div>
            <button class="broadcast-card__close" aria-label="Закрыть карточку" data-card-id="${card.dataset.id}">
                <img src="img/close-icon.svg" alt="" class="broadcast-card__close-icon">
            </button>
            
            <div class="broadcast-card__play-wrapper">
                <img src="img/Warning.svg" alt="" class="quiz-card__icon">
            </div>

            <h3 class="broadcast-card__title">${quizData.title || 'Квиз'}</h3>
            <p class="broadcast-card__date">${questionCount} вопросов</p>
            <p class="broadcast-card__description">${description}</p>

            <div class="broadcast-card__pattern">
                <img src="img/card-pattern.svg" alt="" class="broadcast-card__pattern-image">
            </div>

            <div class="broadcast-card__actions">
                <button class="button button--primary" data-action="create-session" data-quiz-id="${quizData.id}">Создать сессию</button>
                <button class="button button--secondary" data-action="edit-quiz" data-quiz-id="${quizData.id}">Изменить</button>
            </div>
        `;

        
        const closeBtn = card.querySelector('.broadcast-card__close');
        closeBtn.addEventListener('click', () => this.deleteQuizCard(card.dataset.id));

        return card;
    }

    
    addBroadcastCard(sessionData) {
        if (!this.broadcastsContainer) return;

        
        if (!sessionData.id) {
            sessionData.id = Date.now();
        }

        const card = this.createBroadcastCard(sessionData);
        this.broadcastsContainer.appendChild(card);
        this.updateCardWidths(this.broadcastsContainer);

        return card;
    }

    
    addStatisticsCard(sessionData) {
        if (!this.statisticsContainer) return;

        
        if (!sessionData.id) {
            sessionData.id = Date.now();
        }

        const card = this.createStatisticsCard(sessionData);
        this.statisticsContainer.appendChild(card);
        this.updateCardWidths(this.statisticsContainer);

        return card;
    }

    
    addQuizCard(quizData) {
        if (!this.quizzesContainer) return;

        const card = this.createQuizCard(quizData);
        this.quizzesContainer.appendChild(card);
        this.updateCardWidths(this.quizzesContainer);
        return card;
    }

    
    updateCardWidths(container) {
        if (!container) return;

        const cards = container.querySelectorAll('.broadcast-card');
        const cardCount = cards.length;

        if (cardCount === 1) {
            
            cards.forEach(card => {
                card.style.maxWidth = 'calc((100% - 40px) / 2)';
                card.style.minWidth = 'calc((100% - 40px) / 2)';
            });
        } else if (cardCount === 2) {
            
            cards.forEach(card => {
                card.style.maxWidth = 'calc((100% - 40px) / 2)';
                card.style.minWidth = 'calc((100% - 40px) / 2)';
            });
        } else if (cardCount >= 3) {
            
            cards.forEach(card => {
                card.style.maxWidth = '';
                card.style.minWidth = '';
            });
        }
    }

    
    async deleteBroadcastCard(id) {
        const card = document.querySelector(`[data-tab-content="broadcasts"] .broadcast-card[data-id="${id}"]`);
        if (card) {
            try {
                if (typeof apiService !== 'undefined') {
                    await apiService.deleteSession(id);
                }
                card.remove();
                this.updateCardWidths(this.broadcastsContainer);
            } catch (error) {
                console.error('Ошибка при удалении сессии:', error);
                
                card.remove();
                this.updateCardWidths(this.broadcastsContainer);
            }
        }
    }

    
    async deleteQuizCard(id) {
        const card = document.querySelector(`[data-tab-content="quizzes"] .broadcast-card[data-id="${id}"]`);
        if (card) {
            try {
                if (typeof apiService !== 'undefined') {
                    await apiService.deleteQuiz(id);
                }
                card.remove();
                this.updateCardWidths(this.quizzesContainer);
            } catch (error) {
                console.error('Ошибка при удалении квиза:', error);
                
                card.remove();
                this.updateCardWidths(this.quizzesContainer);
            }
        }
    }

    
    async deleteStatisticsCard(id) {
        const card = document.querySelector(`[data-tab-content="statistics"] .broadcast-card[data-id="${id}"]`);
        if (card) {
            card.remove();
            this.updateCardWidths(this.statisticsContainer);
        }
    }

    
    async loadStatisticsCards() {
        if (this.statisticsContainer && typeof apiService !== 'undefined') {
            try {
                const endedSessions = await apiService.getEndedSessions();
                this.statisticsContainer.innerHTML = '';
                if (endedSessions && endedSessions.length > 0) {
                    endedSessions.forEach(session => {
                        this.addStatisticsCard(session);
                    });
                }
                this.updateCardWidths(this.statisticsContainer);
            } catch (error) {
                console.error('Ошибка при загрузке завершенных сессий:', error);
                this.statisticsContainer.innerHTML = '';
            }
        }
    }

    
    async loadAllCards() {
        try {
            
            if (this.broadcastsContainer && typeof apiService !== 'undefined') {
                try {
                    const sessions = await apiService.getSessions();
                    this.broadcastsContainer.innerHTML = '';
                    sessions.forEach(session => {
                        this.addBroadcastCard(session);
                    });
                } catch (error) {
                    console.error('Ошибка при загрузке сессий:', error);
                    this.broadcastsContainer.innerHTML = '';
                }
            }

            
            if (typeof apiService !== 'undefined') {
                
                if (this.quizzesContainer) {
                    this.quizzesContainer.innerHTML = '';
                }

                const quizzes = await apiService.getQuizzes();

                
                const quizzesWithCounts = await Promise.all(
                    quizzes.map(async (quiz) => {
                        let questionCount = 0;
                        try {
                            const questions = await apiService.getQuestions(quiz.id);
                            questionCount = Array.isArray(questions) ? questions.length : 0;
                        } catch (e) {
                            console.error('Не удалось загрузить вопросы для квиза', quiz.id, e);
                        }
                        return {
                            ...quiz,
                            questionCount,
                        };
                    })
                );

                
                this.loadedQuizzes = quizzesWithCounts;

                quizzesWithCounts.forEach(quiz => {
                    this.addQuizCard({
                        id: quiz.id,
                        title: quiz.title,
                        description: quiz.description,
                        questionCount: quiz.questionCount,
                    });
                });

                
                if (typeof updateQuizDropdown === 'function') {
                    updateQuizDropdown(quizzesWithCounts);
                }

                
                updateSessionQuizSelect(quizzesWithCounts);
            }

            

            
            this.updateCardWidths(this.broadcastsContainer);
            this.updateCardWidths(this.quizzesContainer);
            this.updateCardWidths(this.statisticsContainer);
        } catch (error) {
            console.error('Ошибка при загрузке карточек:', error);
        }
    }

    
    init() {
        this.updateCardWidths(this.broadcastsContainer);
        this.updateCardWidths(this.quizzesContainer);
        this.updateCardWidths(this.statisticsContainer);
    }

    
    initExistingCards() {
        
        if (this.broadcastsContainer) {
            const broadcastCards = this.broadcastsContainer.querySelectorAll('.broadcast-card');
            broadcastCards.forEach((card, index) => {
                const closeBtn = card.querySelector('.broadcast-card__close');
                if (closeBtn && !closeBtn.dataset.initialized) {
                    
                    if (!card.dataset.id) {
                        card.dataset.id = `broadcast-${Date.now()}-${index}`;
                    }
                    const cardId = card.dataset.id;
                    closeBtn.dataset.cardId = cardId;
                    closeBtn.dataset.initialized = 'true';
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteBroadcastCard(cardId);
                    });
                }
            });
        }

        
        if (this.quizzesContainer) {
            const quizCards = this.quizzesContainer.querySelectorAll('.broadcast-card');
            quizCards.forEach((card, index) => {
                const closeBtn = card.querySelector('.broadcast-card__close');
                if (closeBtn && !closeBtn.dataset.initialized) {
                    
                    if (!card.dataset.id) {
                        card.dataset.id = `quiz-${Date.now()}-${index}`;
                    }
                    const cardId = card.dataset.id;
                    closeBtn.dataset.cardId = cardId;
                    closeBtn.dataset.initialized = 'true';
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteQuizCard(cardId);
                    });
                }
            });
        }

        
        if (this.statisticsContainer) {
            const statisticsCards = this.statisticsContainer.querySelectorAll('.broadcast-card');
            statisticsCards.forEach((card, index) => {
                const closeBtn = card.querySelector('.broadcast-card__close');
                if (closeBtn && !closeBtn.dataset.initialized) {
                    
                    if (!card.dataset.id) {
                        card.dataset.id = `statistics-${Date.now()}-${index}`;
                    }
                    const cardId = card.dataset.id;
                    closeBtn.dataset.cardId = cardId;
                    closeBtn.dataset.initialized = 'true';
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        
                        card.remove();
                        this.updateCardWidths(this.statisticsContainer);
                    });
                }
            });
        }
    }

    
    formatDate(dateString) {
        if (!dateString) return 'Не указана';

        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${day}.${month}.${year}  ${hours}:${minutes}`;
    }
}


const cardManager = new CardManager();

