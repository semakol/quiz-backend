function preventBodyScroll() {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
        document.body.style.paddingRight = scrollbarWidth + 'px';
    }
    document.body.style.overflow = 'hidden';
}

function restoreBodyScroll() {
    document.body.style.paddingRight = '';
    document.body.style.overflow = '';
}


document.addEventListener('DOMContentLoaded', function() {
    
    const modalTriggers = document.querySelectorAll('[data-modal]');
    const modals = document.querySelectorAll('.modal');
    const modalCloses = document.querySelectorAll('.modal__close, .modal__cancel');

    
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            const modalId = this.getAttribute('data-modal');
            const modal = document.getElementById(`modal-${modalId}`);
            if (modal) {
                
                if (modalId === 'create-broadcast') {
                    const rect = this.getBoundingClientRect();
                    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
                    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                    const modalContent = modal.querySelector('.modal__content--create');
                    if (modalContent) {
                        modalContent.style.left = (rect.left + scrollX) + 'px';
                        modalContent.style.top = (rect.bottom + scrollY + 10) + 'px';
                    }
                }
                
                if (modalId === 'create-quiz') {
                    const rect = this.getBoundingClientRect();
                    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
                    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                    const modalContent = modal.querySelector('.modal__content--create-quiz');
                    if (modalContent) {
                        const buttonCenterX = rect.left + rect.width / 2;
                        const modalWidth = 452;
                        modalContent.style.left = (buttonCenterX - modalWidth / 2 + scrollX) + 'px';
                        modalContent.style.top = (rect.bottom + scrollY + 10) + 'px';
                        modalContent.style.right = 'auto';
                        modalContent.style.transform = 'none';
                    }
                }
                
                if (modalId === 'create-broadcast-new') {
                    const rect = this.getBoundingClientRect();
                    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
                    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                    const modalContent = modal.querySelector('.modal__content--create-quiz');
                    if (modalContent) {
                        const buttonCenterX = rect.left + rect.width / 2;
                        const modalWidth = 452;
                        modalContent.style.left = (buttonCenterX - modalWidth / 2 + scrollX) + 'px';
                        modalContent.style.top = (rect.bottom + scrollY + 10) + 'px';
                        modalContent.style.right = 'auto';
                        modalContent.style.transform = 'none';
                    }
                }
                modal.classList.add('active');
                preventBodyScroll();
            }
        });
    });

    
    function closeModal(modal) {
        modal.classList.remove('active');
        restoreBodyScroll();
    }

    modalCloses.forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                closeModal(modal);
            }
        });
    });

    
    modals.forEach(modal => {
        const overlay = modal.querySelector('.modal__overlay');
        if (overlay) {
            overlay.addEventListener('click', function() {
                closeModal(modal);
            });
        }
        
        modal.addEventListener('click', function(e) {
            
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            modals.forEach(modal => {
                if (modal.classList.contains('active')) {
                    closeModal(modal);
                }
            });
        }
    });

    
    modals.forEach(modal => {
        const content = modal.querySelector('.modal__content');
        if (content) {
            content.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
    });

    
    const dropdownTriggers = document.querySelectorAll('[data-dropdown]');
    const dropdowns = document.querySelectorAll('.dropdown');

    
    dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            const dropdownId = this.getAttribute('data-dropdown');
            const dropdown = document.getElementById(`dropdown-${dropdownId}`);

            if (dropdown) {
                
                dropdowns.forEach(d => {
                    if (d !== dropdown) {
                        d.classList.remove('active');
                    }
                });
                
                dropdown.classList.toggle('active');
            }
        });
    });

    
    const addQuizButtons = document.querySelectorAll('[data-modal="add-quiz"]');
    addQuizButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const dropdown = document.getElementById('dropdown-quiz-list');
            if (dropdown) {
                
                dropdowns.forEach(d => {
                    if (d !== dropdown) {
                        d.classList.remove('active');
                    }
                });
                
                const rect = this.getBoundingClientRect();
                const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
                const scrollY = window.pageYOffset || document.documentElement.scrollTop;

                dropdown.style.left = (rect.left + scrollX) + 'px';
                dropdown.style.top = (rect.bottom + scrollY + 10) + 'px';
                dropdown.classList.toggle('active');
            }
        });
    });

    
    const broadcastsContainer = document.querySelector('[data-tab-content="broadcasts"]');
    if (broadcastsContainer) {
        broadcastsContainer.addEventListener('click', function(e) {
            
            const openSessionButton = e.target.closest('[data-action="open-session"]');
            if (openSessionButton) {
                e.preventDefault();
                e.stopPropagation();
                const sessionId = openSessionButton.dataset.sessionId;
                if (sessionId) {
                    window.location.href = `session.html?id=${sessionId}`;
                }
                return;
            }

            
            const button = e.target.closest('[data-modal="add-quiz"]');
            if (!button) return;

            e.preventDefault();
            e.stopPropagation();

            const dropdown = document.getElementById('dropdown-quiz-list');
            if (!dropdown) return;

            
            dropdowns.forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('active');
                }
            });

            
            const rect = button.getBoundingClientRect();
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;

            dropdown.style.left = (rect.left + scrollX) + 'px';
            dropdown.style.top = (rect.bottom + scrollY + 10) + 'px';
            dropdown.classList.toggle('active');
        });
    }

    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown') && !e.target.closest('[data-dropdown]') && !e.target.closest('[data-modal="add-quiz"]')) {
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });

    
    document.querySelectorAll('.dropdown__item, .dropdown__user-item').forEach(item => {
        item.addEventListener('click', function(e) {
            
            if (this.textContent.includes('Выход') || this.querySelector('img[src*="exit"]')) {
                e.preventDefault();
                if (typeof auth !== 'undefined' && auth.logout) {
                    auth.logout();
                } else {
                    
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('token_type');
                    window.location.href = 'login.html';
                }
                return;
            }
            
            
            const dropdown = this.closest('.dropdown');
            if (dropdown) {
                dropdown.classList.remove('active');
            }
        });
    });

    
    const navLinks = document.querySelectorAll('.nav__link');
    const tabContents = document.querySelectorAll('[data-tab-content]');
    const tabIndicator = document.querySelector('.tab-indicator');

    function activateTab(tabId) {
        
        navLinks.forEach(l => l.classList.remove('nav__link--active'));

        
        const activeLink = document.querySelector(`.nav__link[data-tab="${tabId}"]`);
        if (activeLink) {
            activeLink.classList.add('nav__link--active');
        }

        
        tabContents.forEach(content => {
            content.style.display = 'none';
        });

        
        const activeContent = document.querySelector(`[data-tab-content="${tabId}"]`);
        if (activeContent) {
            activeContent.style.display = 'flex';

            
            if (typeof cardManager !== 'undefined') {
                if (tabId === 'broadcasts') {
                    cardManager.updateCardWidths(cardManager.broadcastsContainer);
                } else if (tabId === 'quizzes') {
                    cardManager.updateCardWidths(cardManager.quizzesContainer);
                } else if (tabId === 'statistics') {
                    
                    cardManager.loadStatisticsCards();
                }
            }
        }

        
        if (tabIndicator) {
            tabIndicator.setAttribute('data-active', tabId);
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');
            window.location.hash = tabId;
            activateTab(tabId);
        });
    });

    
    const hash = window.location.hash.replace('#', '');
    if (hash === 'quizzes' || hash === 'statistics' || hash === 'broadcasts') {
        activateTab(hash);
    } else {
        activateTab('broadcasts');
    }
});


function validateTitle(title, minLength = 3, maxLength = 100) {
    const trimmed = title.trim();
    if (!trimmed) {
        return { valid: false, message: 'Название обязательно для заполнения' };
    }
    if (trimmed.length < minLength) {
        return { valid: false, message: `Название должно содержать минимум ${minLength} символа` };
    }
    if (trimmed.length > maxLength) {
        return { valid: false, message: `Название не должно превышать ${maxLength} символов` };
    }
    return { valid: true };
}

function validateDescription(description, maxLength = 500) {
    const trimmed = description.trim();
    if (trimmed && trimmed.length > maxLength) {
        return { valid: false, message: `Описание не должно превышать ${maxLength} символов` };
    }
    return { valid: true };
}


function updateQuizDropdown(quizzes) {
    const dropdown = document.getElementById('dropdown-quiz-list');
    if (!dropdown) return;

    const content = dropdown.querySelector('.dropdown__content');
    if (!content) return;

    
    
    if (!Array.isArray(quizzes) || quizzes.length === 0) {
        return;
    }

    content.innerHTML = '';

    quizzes.forEach(quiz => {
        const item = document.createElement('div');
        item.className = 'dropdown__item';
        item.dataset.quizId = quiz.id;
        item.textContent = quiz.title || 'Без названия';
        content.appendChild(item);
    });
}

function validateDate(dateString) {
    if (!dateString) {
        return { valid: false, message: 'Дата обязательна для заполнения' };
    }
    const selectedDate = new Date(dateString);
    const now = new Date();
    now.setSeconds(0, 0); 

    if (selectedDate < now) {
        return { valid: false, message: 'Дата не может быть в прошлом' };
    }
    return { valid: true };
}

function showFieldError(field, message) {
    field.classList.add('error');
    let errorElement = field.parentElement.querySelector('.form-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        field.parentElement.appendChild(errorElement);
    }
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

function clearFieldError(field) {
    field.classList.remove('error');
    const errorElement = field.parentElement.querySelector('.form-error');
    if (errorElement) {
        errorElement.classList.remove('show');
    }
}

function clearAllErrors(form) {
    const errorFields = form.querySelectorAll('.error');
    errorFields.forEach(field => clearFieldError(field));
}


document.addEventListener('DOMContentLoaded', function() {
    
    const createQuizForm = document.querySelector('#modal-create-quiz form');
    if (createQuizForm) {
        const titleInput = createQuizForm.querySelector('input[type="text"]');
        const descriptionInput = createQuizForm.querySelector('textarea');

        
        if (titleInput) {
            titleInput.addEventListener('blur', function() {
                const validation = validateTitle(this.value);
                if (!validation.valid) {
                    showFieldError(this, validation.message);
                } else {
                    clearFieldError(this);
                }
            });
            titleInput.addEventListener('input', function() {
                if (this.classList.contains('error')) {
                    const validation = validateTitle(this.value);
                    if (validation.valid) {
                        clearFieldError(this);
                    }
                }
            });
        }

        if (descriptionInput) {
            descriptionInput.addEventListener('blur', function() {
                const validation = validateDescription(this.value);
                if (!validation.valid) {
                    showFieldError(this, validation.message);
                } else {
                    clearFieldError(this);
                }
            });
            descriptionInput.addEventListener('input', function() {
                if (this.classList.contains('error')) {
                    const validation = validateDescription(this.value);
                    if (validation.valid) {
                        clearFieldError(this);
                    }
                }
            });
        }

        createQuizForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            clearAllErrors(this);

            const title = titleInput.value;
            const description = descriptionInput.value;

            let isValid = true;

            
            const titleValidation = validateTitle(title);
            if (!titleValidation.valid) {
                showFieldError(titleInput, titleValidation.message);
                isValid = false;
            }

            
            const descriptionValidation = validateDescription(description);
            if (!descriptionValidation.valid) {
                showFieldError(descriptionInput, descriptionValidation.message);
                isValid = false;
            }

            if (!isValid) {
                return;
            }

            const titleTrimmed = title.trim();
            const descriptionTrimmed = description.trim();

            try {
                let createdQuizId;

                if (typeof apiService !== 'undefined') {
                    
                    const response = await apiService.createQuiz({
                        title: titleTrimmed,
                        description: descriptionTrimmed,
                    });
                    createdQuizId = response.id;
                } else {
                    
                    createdQuizId = Date.now();
                }

                
                localStorage.setItem('editingQuizTitle', titleTrimmed);
                localStorage.setItem('editingQuizDescription', descriptionTrimmed);
                localStorage.setItem('editingQuizId', createdQuizId);

                
                const modal = this.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                    restoreBodyScroll();
                }

                
                clearAllErrors(this);
                this.reset();

                
                window.location.href = 'quiz-editor.html?id=' + createdQuizId;
            } catch (error) {
                console.error('Ошибка при создании квиза:', error);
                alert('Ошибка при создании квиза. Попробуйте еще раз.');
            }
        });
    }

    
    function updateSessionQuizSelect(quizzes) {
        const quizSelect = document.getElementById('session-quiz-select');
        if (!quizSelect) return;

        quizSelect.innerHTML = '<option value="">Выберите квиз...</option>';
        
        if (!quizzes || quizzes.length === 0) {
            quizSelect.innerHTML = '<option value="">Нет доступных квизов</option>';
            return;
        }

        quizzes.forEach(quiz => {
            const option = document.createElement('option');
            option.value = quiz.id;
            option.textContent = quiz.title || `Квиз #${quiz.id}`;
            quizSelect.appendChild(option);
        });

        quizSelect.disabled = false;
    }

    
    const createSessionForm = document.querySelector('#create-session-form');
    if (createSessionForm) {
        const quizSelect = document.getElementById('session-quiz-select');

        
        const modalCreateBroadcast = document.getElementById('modal-create-broadcast-new');
        if (modalCreateBroadcast) {
            
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (modalCreateBroadcast.classList.contains('active')) {
                            
                            if (quizSelect) {
                                
                                if (typeof cardManager !== 'undefined' && cardManager.loadedQuizzes && cardManager.loadedQuizzes.length > 0) {
                                    
                                    updateSessionQuizSelect(cardManager.loadedQuizzes);
                                } else if (quizSelect.options.length <= 1 || quizSelect.options[0].value === '') {
                                    
                                    loadQuizzesForSession();
                                }
                            }
                        }
                    }
                });
            });
            observer.observe(modalCreateBroadcast, { attributes: true });
        }

        
        async function loadQuizzesForSession() {
            if (!quizSelect) return;

            quizSelect.innerHTML = '<option value="">Загрузка квизов...</option>';
            quizSelect.disabled = true;

            try {
                if (typeof apiService === 'undefined') {
                    quizSelect.innerHTML = '<option value="">API недоступен</option>';
                    return;
                }

                const quizzes = await apiService.getQuizzes();

                if (!quizzes || quizzes.length === 0) {
                    quizSelect.innerHTML = '<option value="">Нет доступных квизов</option>';
                    return;
                }

                updateSessionQuizSelect(quizzes);
            } catch (error) {
                console.error('Ошибка при загрузке квизов:', error);
                quizSelect.innerHTML = '<option value="">Ошибка загрузки квизов</option>';
            }
        }

        
        if (quizSelect) {
            quizSelect.addEventListener('change', function() {
                if (this.value) {
                    clearFieldError(this);
                }
            });
        }

        
        createSessionForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            clearAllErrors(this);

            const quizId = quizSelect ? quizSelect.value : null;

            
            if (!quizId) {
                if (quizSelect) {
                    showFieldError(quizSelect, 'Выберите квиз для создания сессии');
                }
                return;
            }

            try {
                if (typeof apiService === 'undefined') {
                    alert('API сервис недоступен');
                    return;
                }

                
                const sessionUrl = `quiz-${quizId}-${Date.now()}`;

                
                const session = await apiService.createSession({
                    quiz_id: parseInt(quizId),
                    url: sessionUrl,
                    status: 'waiting'
                });

                
                const modal = this.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                    restoreBodyScroll();
                }

                
                clearAllErrors(this);
                this.reset();

                
                window.location.href = `session.html?id=${session.id}`;
            } catch (error) {
                console.error('Ошибка при создании сессии:', error);
                const errorMessage = error.message || 'Не удалось создать сессию. Попробуйте еще раз.';
                alert(errorMessage);
            }
        });
    }

    
    if (typeof cardManager !== 'undefined') {
        cardManager.init();
        cardManager.initExistingCards();
        cardManager.loadAllCards().then(() => {
            
            const quizSelect = document.getElementById('session-quiz-select');
            if (quizSelect && cardManager.loadedQuizzes && cardManager.loadedQuizzes.length > 0) {
                updateSessionQuizSelect(cardManager.loadedQuizzes);
            }
        });
    }

    
    const quizzesContainer = document.querySelector('[data-tab-content="quizzes"]');
    if (quizzesContainer) {
        quizzesContainer.addEventListener('click', async function(e) {
            
            const createSessionButton = e.target.closest('[data-action="create-session"]');
            if (createSessionButton) {
                e.preventDefault();
                e.stopPropagation();
                const quizId = createSessionButton.dataset.quizId;
                if (!quizId) return;

                try {
                    if (typeof apiService === 'undefined') {
                        alert('API сервис недоступен');
                        return;
                    }

                    
                    const sessionUrl = `quiz-${quizId}-${Date.now()}`;

                    
                    const session = await apiService.createSession({
                        quiz_id: parseInt(quizId),
                        url: sessionUrl,
                        status: 'waiting'
                    });

                    
                    window.location.href = `session.html?id=${session.id}`;
                } catch (error) {
                    console.error('Ошибка при создании сессии:', error);
                    alert('Не удалось создать сессию. Попробуйте еще раз.');
                }
                return;
            }

            
            const editButton = e.target.closest('[data-action="edit-quiz"]');
            if (!editButton) return;

            const quizId = editButton.dataset.quizId;
            if (!quizId) return;

            try {
                if (typeof apiService !== 'undefined') {
                    const quiz = await apiService.getQuiz(quizId);
                    localStorage.setItem('editingQuizTitle', quiz.title);
                    localStorage.setItem('editingQuizDescription', quiz.description || '');
                    localStorage.setItem('editingQuizId', quiz.id);
                } else {
                    localStorage.setItem('editingQuizTitle', 'Квиз');
                    localStorage.setItem('editingQuizDescription', '');
                    localStorage.setItem('editingQuizId', quizId);
                }

                window.location.href = 'quiz-editor.html?id=' + quizId;
            } catch (error) {
                console.error('Ошибка при загрузке квиза для редактирования:', error);
                alert('Не удалось загрузить квиз. Попробуйте позже.');
            }
        });
    }

    
    const statisticsContainer = document.querySelector('[data-tab-content="statistics"]');
    if (statisticsContainer) {
        statisticsContainer.addEventListener('click', async function(e) {
            
            const exportCsvButton = e.target.closest('[data-action="export-csv"]');
            if (exportCsvButton) {
                e.preventDefault();
                e.stopPropagation();
                const sessionId = exportCsvButton.dataset.sessionId;
                if (!sessionId) return;

                try {
                    if (typeof apiService === 'undefined') {
                        alert('API сервис недоступен');
                        return;
                    }

                    
                    const statistics = await apiService.getSessionStatistics(sessionId);
                    
                    
                    const csv = exportStatisticsToCSV(statistics);
                    
                    
                    downloadCSV(csv, `session_${sessionId}_statistics.csv`);
                } catch (error) {
                    console.error('Ошибка при экспорте в CSV:', error);
                    alert('Не удалось экспортировать данные. Попробуйте еще раз.');
                }
                return;
            }

        });
    }
});


function exportStatisticsToCSV(statistics) {
    const rows = [];
    
    
    rows.push('ID Сессии,Дата начала,Дата окончания');
    const startedAt = statistics.started_at ? new Date(statistics.started_at).toLocaleString('ru-RU') : 'Не указана';
    const endedAt = statistics.ended_at ? new Date(statistics.ended_at).toLocaleString('ru-RU') : 'Не указана';
    rows.push(`${statistics.session_id},"${startedAt}","${endedAt}"`);
    
    
    rows.push('');
    
    
    rows.push('Игрок,Баллы,Дата присоединения');
    
    
    if (statistics.players && statistics.players.length > 0) {
        statistics.players.forEach(player => {
            const joinedAt = player.joined_at ? new Date(player.joined_at).toLocaleString('ru-RU') : 'Не указана';
            const nickname = (player.nickname || `Игрок #${player.id}`).replace(/"/g, '""');
            rows.push(`"${nickname}",${player.score || 0},"${joinedAt}"`);
        });
    } else {
        rows.push('Нет данных об игроках');
    }
    
    return rows.join('\n');
}


function downloadCSV(csvContent, filename) {
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    
    URL.revokeObjectURL(url);
}
