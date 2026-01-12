document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;

    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    
    usernameInput.addEventListener('blur', function() {
        validateUsername(this.value);
    });

    emailInput.addEventListener('blur', function() {
        validateEmail(this.value);
    });

    passwordInput.addEventListener('blur', function() {
        validatePassword(this.value);
        if (confirmPasswordInput.value) {
            validatePasswordMatch(passwordInput.value, confirmPasswordInput.value);
        }
    });

    confirmPasswordInput.addEventListener('blur', function() {
        if (passwordInput.value) {
            validatePasswordMatch(passwordInput.value, this.value);
        }
    });

    
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        
        clearAllErrors();

        
        const usernameValid = validateUsername(usernameInput.value);
        const emailValid = validateEmail(emailInput.value);
        const passwordValid = validatePassword(passwordInput.value);
        const passwordMatchValid = validatePasswordMatch(passwordInput.value, confirmPasswordInput.value);

        if (!usernameValid || !emailValid || !passwordValid || !passwordMatchValid) {
            return;
        }

        
        try {
            const userData = {
                username: usernameInput.value.trim(),
                email: emailInput.value.trim(),
                password: passwordInput.value,
            };

            if (typeof apiService === 'undefined') {
                showGeneralError('API сервис недоступен');
                return;
            }

            const response = await apiService.signup(userData);
            
            
            alert('Регистрация успешна! Теперь вы можете войти.');
            
            
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Ошибка при регистрации:', error);
            
            
            const errorMessage = error.message || 'Ошибка при регистрации. Попробуйте еще раз.';
            
            if (errorMessage.includes('Email already registered') || errorMessage.includes('уже зарегистрирован')) {
                showFieldError(emailInput, 'Этот email уже зарегистрирован');
            } else if (errorMessage.includes('username') || errorMessage.includes('имя пользователя')) {
                showFieldError(usernameInput, 'Имя пользователя уже занято');
            } else {
                showGeneralError(errorMessage);
            }
        }
    });

    
    function validateUsername(username) {
        const trimmed = username.trim();
        if (!trimmed) {
            showFieldError(usernameInput, 'Имя пользователя обязательно');
            return false;
        }
        if (trimmed.length < 3) {
            showFieldError(usernameInput, 'Имя пользователя должно содержать минимум 3 символа');
            return false;
        }
        if (trimmed.length > 50) {
            showFieldError(usernameInput, 'Имя пользователя не должно превышать 50 символов');
            return false;
        }
        clearFieldError(usernameInput);
        return true;
    }

    function validateEmail(email) {
        const trimmed = email.trim();
        if (!trimmed) {
            showFieldError(emailInput, 'Email обязателен');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
            showFieldError(emailInput, 'Введите корректный email');
            return false;
        }
        clearFieldError(emailInput);
        return true;
    }

    function validatePassword(password) {
        if (!password) {
            showFieldError(passwordInput, 'Пароль обязателен');
            return false;
        }
        if (password.length < 6) {
            showFieldError(passwordInput, 'Пароль должен содержать минимум 6 символов');
            return false;
        }
        if (password.length > 100) {
            showFieldError(passwordInput, 'Пароль не должен превышать 100 символов');
            return false;
        }
        clearFieldError(passwordInput);
        return true;
    }

    function validatePasswordMatch(password, confirmPassword) {
        if (!confirmPassword) {
            showFieldError(confirmPasswordInput, 'Подтвердите пароль');
            return false;
        }
        if (password !== confirmPassword) {
            showFieldError(confirmPasswordInput, 'Пароли не совпадают');
            return false;
        }
        clearFieldError(confirmPasswordInput);
        return true;
    }

    function showFieldError(field, message) {
        field.classList.add('error');
        const fieldName = field.id;
        const errorElement = document.getElementById(`${fieldName}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    function clearFieldError(field) {
        field.classList.remove('error');
        const fieldName = field.id;
        const errorElement = document.getElementById(`${fieldName}-error`);
        if (errorElement) {
            errorElement.classList.remove('show');
            errorElement.textContent = '';
        }
    }

    function showGeneralError(message) {
        const errorElement = document.getElementById('general-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    function clearAllErrors() {
        [usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach(clearFieldError);
        const generalError = document.getElementById('general-error');
        if (generalError) {
            generalError.classList.remove('show');
            generalError.textContent = '';
        }
    }
});

