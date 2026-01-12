class QuizEditor {
    constructor() {
        this.quizId = this.getQuizIdFromUrl();
        this.questions = [];
        this.initialQuestionIds = [];
        this.init();
    }

    getQuizIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') || null;
    }

    init() {
        this.loadQuizData();
        this.setupEventListeners();
    }

    async loadQuizData() {
        try {
            let quizTitle = localStorage.getItem('editingQuizTitle') || 'Название квиза';

            
            if (this.quizId && typeof apiService !== 'undefined') {
                try {
                    const quiz = await apiService.getQuiz(this.quizId);
                    quizTitle = quiz.title || quizTitle;

                    
                    const questionsFromApi = await apiService.getQuestions(this.quizId);

                    this.initialQuestionIds = questionsFromApi.map(q => q.id);

                    
                    this.questions = await Promise.all(questionsFromApi.map(async (q, idx) => {
                        const answers = Array.isArray(q.answers) ? q.answers : [];

                        
                        const mappedAnswers = answers.map(ans => ({
                            text: ans.text || '',
                            isCorrect: !!ans.is_correct,
                        }));

                        
                        const type = q.type === 'open' ? 'open' : 'test';

                        
                        let openAnswer = '';
                        if (type === 'open') {
                            const correct = mappedAnswers.find(a => a.isCorrect);
                            openAnswer = correct ? correct.text : (mappedAnswers[0]?.text || '');
                        }

                        
                        let mediaInfo = null;
                        if (q.media_id) {
                            try {
                                mediaInfo = await apiService.getMedia(q.media_id);
                            } catch (e) {
                                console.error(`Не удалось загрузить медиа ${q.media_id}:`, e);
                            }
                        }

                        return {
                            id: q.id,
                            type,
                            text: q.text || '',
                            answer: openAnswer,
                            answers: type === 'test' ? mappedAnswers : [],
                            points: q.score || 1, 
                            time: q.time_limit || 1,
                            media_id: q.media_id || null,
                            media_info: mediaInfo,
                            orderIndex: q.order_index ?? idx,
                        };
                    }));
                } catch (e) {
                    console.error('Не удалось загрузить квиз/вопросы из бекенда, используем локальные данные:', e);
                }
            }

            const titleHeader = document.getElementById('quiz-title-header');
            if (titleHeader) {
                titleHeader.textContent = quizTitle;
            }

            this.renderQuestions();
        } catch (error) {
            console.error('Ошибка при загрузке квиза:', error);
        }
    }

    buildQuestionPayload(question, index) {
        const base = {
            text: question.text || '',
            type: question.type === 'open' ? 'open' : 'test',
            time_limit: question.time || 1,
            order_index: index,
            media_id: question.media_id || null,
            score: question.points || 1, 
        };

        let answers = [];

        if (base.type === 'open') {
            if (question.answer && question.answer.trim() !== '') {
                answers = [
                    {
                        
                        question_id: 0,
                        text: question.answer,
                        is_correct: true,
                    },
                ];
            }
        } else {
            answers = (question.answers || []).map(a => ({
                question_id: 0,
                text: a.text || '',
                is_correct: !!a.isCorrect,
            })).filter(a => a.text.trim() !== '');
        }

        return {
            ...base,
            answers,
        };
    }

    setupEventListeners() {
        
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        
        const saveButton = document.getElementById('save-quiz-button');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveQuiz());
        }

        
        const questionsList = document.getElementById('questions-list');
        if (questionsList) {
            questionsList.addEventListener('click', (e) => {
                const mediaButton = e.target.closest('[data-media]');
                if (mediaButton) {
                    e.preventDefault();
                    e.stopPropagation();
                    const questionDiv = mediaButton.closest('[data-index]');
                    if (questionDiv) {
                        const questionIndex = parseInt(questionDiv.dataset.index);
                        const mediaType = mediaButton.dataset.media;
                        console.log('Делегированный клик по кнопке медиа:', mediaType, 'для вопроса', questionIndex);
                        this.handleMediaUpload(questionIndex, mediaType);
                    }
                }
            });
        }

        
        const addQuestionButton = document.getElementById('add-question-button');
        const dropdown = document.getElementById('question-type-dropdown');

        if (addQuestionButton && dropdown) {
            addQuestionButton.addEventListener('click', (e) => {
                e.stopPropagation();
                addQuestionButton.classList.toggle('active');
                dropdown.classList.toggle('active');
            });

            
            document.addEventListener('click', (e) => {
                if (!addQuestionButton.contains(e.target) && !dropdown.contains(e.target)) {
                    addQuestionButton.classList.remove('active');
                    dropdown.classList.remove('active');
                }
            });

            
            const dropdownItems = dropdown.querySelectorAll('[data-question-type]');
            dropdownItems.forEach(item => {
                item.addEventListener('click', () => {
                    const questionType = item.dataset.questionType;
                    this.addQuestion(questionType);
                    addQuestionButton.classList.remove('active');
                    dropdown.classList.remove('active');
                });
            });
        }
    }

    addQuestion(type) {
        const question = {
            type: type, 
            text: '',
            answer: '',
            answers: type === 'test' ? [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] : [],
            
            points: 1, 
            time: 0,
            media_id: null,
            media_info: null
        };

        this.questions.push(question);
        this.renderQuestions();
    }

    renderQuestions() {
        const questionsList = document.getElementById('questions-list');
        if (!questionsList) return;

        questionsList.innerHTML = '';

        if (this.questions.length === 0) {
            questionsList.innerHTML = '<p class="quiz-editor__empty">Вопросы отсутствуют. Добавьте первый вопрос.</p>';
            return;
        }

        this.questions.forEach((question, index) => {
            const questionElement = this.createQuestionElement(question, index);
            questionsList.appendChild(questionElement);
        });
    }

    createQuestionElement(question, index) {
        const questionDiv = document.createElement('div');
        questionDiv.className = `question-item question-item--${question.type}`;
        questionDiv.dataset.index = index;

        if (question.type === 'open') {
            questionDiv.innerHTML = this.createOpenQuestionHTML(question, index);
        } else {
            questionDiv.innerHTML = this.createTestQuestionHTML(question, index);
        }

        
        this.setupQuestionEventListeners(questionDiv, question, index);
        
        
        const removeMediaBtn = questionDiv.querySelector('[data-action="remove-media"]');
        if (removeMediaBtn) {
            removeMediaBtn.addEventListener('click', () => {
                this.questions[index].media_id = null;
                this.questions[index].media_info = null;
                this.renderQuestions();
            });
        }

        return questionDiv;
    }

    createOpenQuestionHTML(question, index) {
        const mediaPreview = this.getMediaPreviewHTML(question);
        return `
            <button class="question-item__close" aria-label="Закрыть">
                <img src="img/close-icon.svg" alt="" class="question-item__close-icon">
            </button>
            <input type="text" class="question-item__question-field" placeholder="Вопрос" value="${this.escapeHtml(question.text)}" data-field="text">
            ${mediaPreview}
            <div class="question-item__answer-row">
                <input type="text" class="question-item__answer-field" placeholder="Ответ" value="${this.escapeHtml(question.answer)}" data-field="answer">
                <div class="question-item__media-buttons">
                    <button type="button" class="question-item__media-button" data-media="video">Добавить видео</button>
                    <button type="button" class="question-item__media-button" data-media="image">Добавить изображение</button>
                </div>
                <div class="question-item__controls">
                    <div class="question-item__control-button" data-control="points" data-selected="${question.points || 0}">
                        <span>${question.points ? String(question.points).padStart(2, '0') : 'Баллы'}</span>
                        <img src="img/arrow-down.svg" alt="" class="question-item__control-arrow">
                        <div class="question-item__control-dropdown" data-dropdown="points">
                            ${this.generateDropdownOptions(1, 99, question.points || 1)}
                        </div>
                    </div>
                    <div class="question-item__control-button" data-control="time" data-selected="${question.time || 0}">
                        <span>${question.time ? String(question.time).padStart(2, '0') : 'Время'}</span>
                        <img src="img/arrow-down.svg" alt="" class="question-item__control-arrow">
                        <div class="question-item__control-dropdown" data-dropdown="time">
                            ${this.generateDropdownOptions(1, 99, question.time || 1)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createTestQuestionHTML(question, index) {
        const firstAnswer = question.answers[0] || { text: '' };
        const otherAnswers = question.answers.slice(1);

        
        const firstAnswerHTML = `
            <div class="answer-item-test" data-answer-index="0">
                <img src="img/Done_round_light.svg" alt="" class="answer-item-test__icon" data-action="correct">
                <input type="text" class="answer-item-test__input" placeholder="Вариант ответа" value="${this.escapeHtml(firstAnswer.text)}" data-field="answer">
            </div>
        `;

        
        const otherAnswersHTML = otherAnswers.map((answer, answerIndex) => {
            return `
                <div class="answer-item-test" data-answer-index="${answerIndex + 1}" style="margin-top: ${answerIndex === 0 ? '18px' : '20px'};">
                    <img src="img/Close_round.svg" alt="" class="answer-item-test__icon" data-action="incorrect">
                    <input type="text" class="answer-item-test__input" placeholder="Вариант ответа" value="${this.escapeHtml(answer.text)}" data-field="answer">
                    <img src="img/Trash_Full.svg" alt="Удалить" class="answer-item-test__delete" data-action="delete">
                </div>
            `;
        }).join('');

        
        const addButtonHTML = `
            <button class="answer-item-test__add" data-action="add-answer">
                <img src="img/plus-icon.svg" alt="Добавить ответ" class="answer-item-test__add-icon">
            </button>
        `;

        const mediaPreview = this.getMediaPreviewHTML(question);
        return `
            <button class="question-item__close" aria-label="Закрыть">
                <img src="img/close-icon.svg" alt="" class="question-item__close-icon">
            </button>
            <input type="text" class="question-item__question-field" placeholder="Вопрос" value="${this.escapeHtml(question.text)}" data-field="text">
            ${mediaPreview}
            <div class="question-item__answer-row">
                <div class="question-item__answers-container">
                    ${firstAnswerHTML}
                    ${otherAnswersHTML}
                    ${addButtonHTML}
                </div>
                <div class="question-item__media-buttons question-item__media-buttons--test">
                    <button type="button" class="question-item__media-button" data-media="video">Добавить видео</button>
                    <button type="button" class="question-item__media-button" data-media="image">Добавить изображение</button>
                </div>
                <div class="question-item__controls">
                    <div class="question-item__control-button" data-control="points" data-selected="${question.points || 0}">
                        <span>${question.points ? String(question.points).padStart(2, '0') : 'Баллы'}</span>
                        <img src="img/arrow-down.svg" alt="" class="question-item__control-arrow">
                        <div class="question-item__control-dropdown" data-dropdown="points">
                            ${this.generateDropdownOptions(1, 99, question.points || 1)}
                        </div>
                    </div>
                    <div class="question-item__control-button" data-control="time" data-selected="${question.time || 0}">
                        <span>${question.time ? String(question.time).padStart(2, '0') : 'Время'}</span>
                        <img src="img/arrow-down.svg" alt="" class="question-item__control-arrow">
                        <div class="question-item__control-dropdown" data-dropdown="time">
                            ${this.generateDropdownOptions(1, 99, question.time || 1)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateDropdownOptions(min, max, current) {
        let options = '';
        for (let i = min; i <= max; i++) {
            const padded = String(i).padStart(2, '0');
            const selected = i === current ? 'class="question-item__control-dropdown-item selected"' : 'class="question-item__control-dropdown-item"';
            options += `<div ${selected} data-value="${i}">${padded}</div>`;
        }
        return options;
    }

    setupQuestionEventListeners(questionDiv, question, index) {
        
        const closeBtn = questionDiv.querySelector('.question-item__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.deleteQuestion(index));
        }

        
        const textField = questionDiv.querySelector('[data-field="text"]');
        if (textField) {
            textField.addEventListener('input', (e) => {
                this.questions[index].text = e.target.value;
            });
        }

        if (question.type === 'open') {
            const answerField = questionDiv.querySelector('[data-field="answer"]');
            if (answerField) {
                answerField.addEventListener('input', (e) => {
                    this.questions[index].answer = e.target.value;
                });
            }

            
            const mediaButtons = questionDiv.querySelectorAll('[data-media]');
            if (mediaButtons.length === 0) {
                console.warn('Кнопки медиа не найдены для открытого вопроса', questionDiv);
            }
            mediaButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const mediaType = btn.dataset.media;
                    console.log('Клик по кнопке медиа:', mediaType, 'для вопроса', index);
                    this.handleMediaUpload(index, mediaType);
                });
            });
        } else {
            
            const answersContainer = questionDiv.querySelector('.question-item__answers-container');
            if (answersContainer) {
                answersContainer.addEventListener('input', (e) => {
                    if (e.target.classList.contains('answer-item-test__input')) {
                        const answerIndex = parseInt(e.target.closest('.answer-item-test').dataset.answerIndex);
                        this.questions[index].answers[answerIndex].text = e.target.value;
                    }
                });

                answersContainer.addEventListener('click', (e) => {
                    const answerItem = e.target.closest('.answer-item-test');
                    if (!answerItem) return;

                    if (e.target.classList.contains('answer-item-test__delete')) {
                        const answerIndex = parseInt(answerItem.dataset.answerIndex);
                        if (this.questions[index].answers.length > 1) {
                            this.questions[index].answers.splice(answerIndex, 1);
                            this.renderQuestions();
                        }
                    }
                });
            }

            
            const addAnswerBtn = questionDiv.querySelector('.question-item__answers-container .answer-item-test__add');
            if (addAnswerBtn) {
                addAnswerBtn.addEventListener('click', () => {
                    this.questions[index].answers.push({ text: '', isCorrect: false });
                    this.renderQuestions();
                });
            }

            
            const mediaButtons = questionDiv.querySelectorAll('[data-media]');
            if (mediaButtons.length === 0) {
                console.warn('Кнопки медиа не найдены для тестового вопроса', questionDiv);
            }
            mediaButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const mediaType = btn.dataset.media;
                    console.log('Клик по кнопке медиа:', mediaType, 'для вопроса', index);
                    this.handleMediaUpload(index, mediaType);
                });
            });
        }

        
        const controlButtons = questionDiv.querySelectorAll('[data-control]');
        controlButtons.forEach(btn => {
            const dropdown = btn.querySelector('.question-item__control-dropdown');
            const span = btn.querySelector('span');

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                btn.classList.toggle('active');
                dropdown.classList.toggle('active');
            });

            dropdown.addEventListener('click', (e) => {
                if (e.target.classList.contains('question-item__control-dropdown-item')) {
                    const value = parseInt(e.target.dataset.value);
                    const controlType = btn.dataset.control;
                    this.questions[index][controlType] = value;
                    span.textContent = String(value).padStart(2, '0');
                    btn.dataset.selected = value;
                    btn.classList.remove('active');
                    dropdown.classList.remove('active');
                    this.renderQuestions();
                }
            });
        });

        
        document.addEventListener('click', () => {
            controlButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.querySelector('.question-item__control-dropdown').classList.remove('active');
            });
        });
    }

    deleteQuestion(index) {
        this.questions.splice(index, 1);
        this.renderQuestions();
    }

    async saveQuiz() {
        try {
            if (!this.quizId || typeof apiService === 'undefined') {
                alert('Нет идентификатора квиза или API недоступен, вопросы не могут быть сохранены.');
                return;
            }

            const quizIdNum = Number(this.quizId);
            const savedIds = [];

            
            for (let i = 0; i < this.questions.length; i++) {
                const q = this.questions[i];
                const payload = this.buildQuestionPayload(q, i);

                
                if (!payload.text.trim()) {
                    continue;
                }

                let result;
                if (q.id) {
                    result = await apiService.updateQuestion(q.id, payload);
                } else {
                    result = await apiService.createQuestion(quizIdNum, payload);
                }

                this.questions[i].id = result.id;
                savedIds.push(result.id);
            }

            
            const toDelete = (this.initialQuestionIds || []).filter(id => !savedIds.includes(id));
            for (const id of toDelete) {
                await apiService.deleteQuestion(id);
            }

            this.initialQuestionIds = savedIds;

            
            window.location.href = 'index.html#quizzes';
        } catch (error) {
            console.error('Ошибка при сохранении квиза:', error);
            alert('Ошибка при сохранении квиза. Попробуйте еще раз.');
        }
    }

    async handleMediaUpload(questionIndex, mediaType) {
        console.log('handleMediaUpload вызван:', { questionIndex, mediaType });
        
        
        if (typeof apiService === 'undefined') {
            console.error('apiService не определен');
            alert('API сервис недоступен. Пожалуйста, обновите страницу.');
            return;
        }
        
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = this.getAcceptTypes(mediaType);
        input.style.display = 'none';
        
        let inputRemoved = false;
        
        const cleanup = () => {
            if (!inputRemoved && document.body.contains(input)) {
                document.body.removeChild(input);
                inputRemoved = true;
            }
        };
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {
                cleanup();
                return;
            }
            
            try {
                
                const questionDiv = document.querySelector(`[data-index="${questionIndex}"]`);
                const mediaButtons = questionDiv?.querySelectorAll('[data-media]');
                if (mediaButtons) {
                    mediaButtons.forEach(btn => {
                        btn.disabled = true;
                        btn.textContent = 'Загрузка...';
                    });
                }
                
                
                const media = await apiService.uploadMedia(file);
                
                
                this.questions[questionIndex].media_id = media.id;
                this.questions[questionIndex].media_info = media;
                
                
                this.renderQuestions();
            } catch (error) {
                console.error('Ошибка при загрузке медиа:', error);
                alert('Ошибка при загрузке медиа. Попробуйте еще раз.');
                
                
                const questionDiv = document.querySelector(`[data-index="${questionIndex}"]`);
                const mediaButtons = questionDiv?.querySelectorAll('[data-media]');
                if (mediaButtons) {
                    mediaButtons.forEach(btn => {
                        btn.disabled = false;
                        const mediaType = btn.dataset.media;
                        if (mediaType === 'video') {
                            btn.textContent = 'Добавить видео';
                        } else if (mediaType === 'audio') {
                            btn.textContent = 'Добавить аудио';
                        } else if (mediaType === 'image') {
                            btn.textContent = 'Добавить изображение';
                        }
                    });
                }
            } finally {
                cleanup();
            }
        });
        
        
        input.addEventListener('cancel', () => {
            cleanup();
        });
        
        
        window.addEventListener('focus', () => {
            setTimeout(() => {
                if (!input.files || input.files.length === 0) {
                    cleanup();
                }
            }, 300);
        }, { once: true });
        
        document.body.appendChild(input);
        input.click();
    }
    
    getAcceptTypes(mediaType) {
        switch (mediaType) {
            case 'image':
                return 'image/*';
            case 'video':
                return 'video/*';
            case 'audio':
                return 'audio/*';
            default:
                return '*/*';
        }
    }
    
    getMediaPreviewHTML(question) {
        if (!question.media_id || !question.media_info) {
            return '';
        }
        
        const mediaUrl = apiService.getMediaUrl(question.media_info.uri);
        const fileName = question.media_info.title || 'Медиафайл';
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        
        
        let mediaType = 'unknown';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension)) {
            mediaType = 'image';
        } else if (['mp4', 'webm', 'ogg'].includes(fileExtension)) {
            mediaType = 'video';
        } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension)) {
            mediaType = 'audio';
        }
        
        let previewHTML = '';
        if (mediaType === 'image') {
            previewHTML = `
                <div class="question-item__media-preview">
                    <img src="${mediaUrl}" alt="${fileName}" class="question-item__media-preview-image">
                    <button class="question-item__media-remove" data-action="remove-media">×</button>
                </div>
            `;
        } else if (mediaType === 'video') {
            previewHTML = `
                <div class="question-item__media-preview">
                    <video src="${mediaUrl}" controls class="question-item__media-preview-video"></video>
                    <button class="question-item__media-remove" data-action="remove-media">×</button>
                </div>
            `;
        } else if (mediaType === 'audio') {
            previewHTML = `
                <div class="question-item__media-preview">
                    <audio src="${mediaUrl}" controls class="question-item__media-preview-audio"></audio>
                    <button class="question-item__media-remove" data-action="remove-media">×</button>
                </div>
            `;
        } else {
            previewHTML = `
                <div class="question-item__media-preview">
                    <a href="${mediaUrl}" target="_blank" class="question-item__media-link">${fileName}</a>
                    <button class="question-item__media-remove" data-action="remove-media">×</button>
                </div>
            `;
        }
        
        return previewHTML;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}


document.addEventListener('DOMContentLoaded', function() {
    window.quizEditor = new QuizEditor();
});
