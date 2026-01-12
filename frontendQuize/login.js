document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    
    emailInput.addEventListener('blur', function() {
        validateEmail(this.value);
    });

    passwordInput.addEventListener('blur', function() {
        validatePassword(this.value);
    });

    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        
        clearAllErrors();

        
        const emailValid = validateEmail(emailInput.value);
        const passwordValid = validatePassword(passwordInput.value);

        if (!emailValid || !passwordValid) {
            return;
        }

        
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (typeof apiService === 'undefined') {
                showGeneralError('API сервис недоступен');
                return;
            }

            const response = await apiService.login(email, password);
            
            
            if (response.access_token) {
                localStorage.setItem('access_token', response.access_token);
                localStorage.setItem('token_type', response.token_type || 'bearer');
            }
            
            
            alert('Вход выполнен успешно!');
            
            
            const returnUrl = sessionStorage.getItem('returnUrl');
            if (returnUrl) {
                sessionStorage.removeItem('returnUrl');
                window.location.href = returnUrl;
            } else {
                
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Ошибка при входе:', error);
            
            
            const errorMessage = error.message || 'Ошибка при входе. Попробуйте еще раз.';
            
            if (errorMessage.includes('Incorrect credentials') || 
                errorMessage.includes('неверные') || 
                errorMessage.includes('неправильные')) {
                showGeneralError('Неверный email или пароль');
            } else {
                showGeneralError(errorMessage);
            }
        }
    });

    
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
        clearFieldError(passwordInput);
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
        [emailInput, passwordInput].forEach(clearFieldError);
        const generalError = document.getElementById('general-error');
        if (generalError) {
            generalError.classList.remove('show');
            generalError.textContent = '';
        }
    }
});

