console.log('Скрипт завантажено');

    // Глобальні змінні
    let currentUser = null;
    let recipes = [];
    let editIndex = null;

    // Список адміністраторів (можна додавати нових)
    const ADMIN_USERNAMES = ['admin', 'Administrator', 'адмін'];

    // Функції для роботи з localStorage
    function saveToStorage(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Збережено ${key}:`, data);
      } catch (error) {
        console.error('Помилка збереження:', error);
      }
    }

    function getFromStorage(key) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('Помилка читання:', error);
        return null;
      }
    }

    // Функція перевірки ролі адміністратора
    function isAdmin(user) {
      return user && ADMIN_USERNAMES.includes(user.username);
    }

    // Функції авторизації
    function hashPassword(password) {
      let hash = 0;
      for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString();
    }

    function register(username, email, password) {
      const users = getFromStorage('users') || [];
      
      if (users.find(u => u.username === username || u.email === email)) {
        throw new Error('Користувач з таким ім\'ям або email вже існує');
      }

      const newUser = {
        id: Date.now(),
        username,
        email,
        password: hashPassword(password),
        isAdmin: isAdmin({ username }),
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveToStorage('users', users);
      
      return newUser;
    }

    function login(username, password) {
      const users = getFromStorage('users') || [];
      const user = users.find(u => 
        (u.username === username || u.email === username) && 
        u.password === hashPassword(password)
      );

      if (!user) {
        throw new Error('Невірне ім\'я користувача або пароль');
      }

      // Оновлюємо статус адміністратора при вході
      user.isAdmin = isAdmin(user);
      currentUser = user;
      saveToStorage('currentUser', user);
      return user;
    }

    function logout() {
      currentUser = null;
      localStorage.removeItem('currentUser');
      showGuestInterface();
    }

    // Функції адміністратора
    function getAllUsers() {
      return getFromStorage('users') || [];
    }

    function getAllUserRecipes() {
      const users = getAllUsers();
      const allRecipes = [];

      users.forEach(user => {
        const userRecipes = getFromStorage(`recipes_${user.id}`) || [];
        userRecipes.forEach(recipe => {
          allRecipes.push({
            ...recipe,
            userId: user.id,
            ownerUsername: user.username
          });
        });
      });

      return allRecipes;
    }

    function deleteAllUserRecipes(userId) {
      if (!currentUser || !currentUser.isAdmin) {
        throw new Error('Недостатньо прав для виконання цієї операції');
      }

      localStorage.removeItem(`recipes_${userId}`);
      console.log(`Всі рецепти користувача ${userId} видалено адміністратором`);
    }

    function deleteUserRecipe(userId, recipeIndex) {
      if (!currentUser || !currentUser.isAdmin) {
        throw new Error('Недостатньо прав для виконання цієї операції');
      }

      const userRecipes = getFromStorage(`recipes_${userId}`) || [];
      if (recipeIndex >= 0 && recipeIndex < userRecipes.length) {
        userRecipes.splice(recipeIndex, 1);
        saveToStorage(`recipes_${userId}`, userRecipes);
        console.log(`Рецепт користувача ${userId} видалено адміністратором`);
      }
    }

    // Функції інтерфейсу
    function showGuestInterface() {
      document.getElementById('guest-section').classList.remove('hidden');
      document.getElementById('user-section').classList.add('hidden');
      document.getElementById('admin-section')?.classList.add('hidden');
      document.getElementById('add-recipe-btn').classList.add('hidden');
      document.getElementById('auth-btn').classList.remove('hidden');
      document.getElementById('logout-btn').classList.add('hidden');
      document.getElementById('admin-btn')?.classList.add('hidden');
    }

    function showUserInterface() {
      document.getElementById('guest-section').classList.add('hidden');
      document.getElementById('user-section').classList.remove('hidden');
      document.getElementById('admin-section')?.classList.add('hidden');
      document.getElementById('add-recipe-btn').classList.remove('hidden');
      document.getElementById('auth-btn').classList.add('hidden');
      document.getElementById('logout-btn').classList.remove('hidden');
      
      // Показуємо кнопку адміна, якщо поточний користувач - адмін
      const adminBtn = document.getElementById('admin-btn');
      if (adminBtn) {
        if (currentUser && currentUser.isAdmin) {
          adminBtn.classList.remove('hidden');
        } else {
          adminBtn.classList.add('hidden');
        }
      }
      
      loadUserRecipes();
      renderRecipes();
    }

    function showAdminInterface() {
      if (!currentUser || !currentUser.isAdmin) {
        alert('У вас немає прав адміністратора!');
        return;
      }

      document.getElementById('guest-section').classList.add('hidden');
      document.getElementById('user-section').classList.add('hidden');
      
      let adminSection = document.getElementById('admin-section');
      if (!adminSection) {
        createAdminInterface();
        adminSection = document.getElementById('admin-section');
      }
      
      adminSection.classList.remove('hidden');
      renderAdminData();
    }

    function createAdminInterface() {
      const container = document.querySelector('.container');
      const adminSection = document.createElement('div');
      adminSection.id = 'admin-section';
      adminSection.className = 'hidden';
      adminSection.innerHTML = `
        <div class="admin-panel">
          <h2>🛡️ Панель адміністратора</h2>
          <div class="admin-actions">
            <button id="back-to-recipes-btn" class="admin-btn">← Повернутися до рецептів</button>
            <h3>Управління користувачами та рецептами</h3>
          </div>
          <div id="admin-content">
            <div class="loading">Завантаження даних...</div>
          </div>
        </div>
      `;
      
      container.appendChild(adminSection);
      
      // Додаємо обробник для кнопки повернення
      document.getElementById('back-to-recipes-btn').addEventListener('click', () => {
        showUserInterface();
      });
    }

    function renderAdminData() {
      const adminContent = document.getElementById('admin-content');
      if (!adminContent) return;

      const users = getAllUsers();
      const allRecipes = getAllUserRecipes();

      let html = `
        <div class="admin-stats">
          <div class="stat-item">
            <h4>📊 Статистика</h4>
            <p>Всього користувачів: <strong>${users.length}</strong></p>
            <p>Всього рецептів: <strong>${allRecipes.length}</strong></p>
          </div>
        </div>

        <div class="users-management">
          <h3>👥 Управління користувачами</h3>
      `;

      users.forEach(user => {
        const userRecipes = getFromStorage(`recipes_${user.id}`) || [];
        const userDate = new Date(user.createdAt).toLocaleDateString('uk-UA');
        
        html += `
          <div class="user-card ${user.isAdmin ? 'admin-user' : ''}">
            <div class="user-info">
              <h4>${user.username} ${user.isAdmin ? '🛡️' : ''}</h4>
              <p>Email: ${user.email}</p>
              <p>Зареєстрований: ${userDate}</p>
              <p>Рецептів: <strong>${userRecipes.length}</strong></p>
            </div>
            <div class="user-actions">
              ${userRecipes.length > 0 ? `
                <button class="danger-btn" onclick="confirmDeleteAllUserRecipes(${user.id}, '${user.username}')">
                  🗑️ Видалити всі рецепти
                </button>
                <button class="info-btn" onclick="showUserRecipes(${user.id}, '${user.username}')">
                  📋 Переглянути рецепти
                </button>
              ` : '<p class="no-recipes">Немає рецептів</p>'}
            </div>
          </div>
        `;
      });

      html += '</div>';
      adminContent.innerHTML = html;
    }

    // Глобальні функції для адміністратора (потрібні для onclick)
    window.confirmDeleteAllUserRecipes = function(userId, username) {
      if (confirm(`Ви впевнені, що хочете видалити ВСІ рецепти користувача "${username}"?\n\nЦю дію неможливо відмінити!`)) {
        try {
          deleteAllUserRecipes(userId);
          alert(`Всі рецепти користувача "${username}" успішно видалено.`);
          renderAdminData();
        } catch (error) {
          alert('Помилка: ' + error.message);
        }
      }
    };

    window.showUserRecipes = function(userId, username) {
      const userRecipes = getFromStorage(`recipes_${userId}`) || [];
      
      let html = `
        <div class="user-recipes-modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3>📋 Рецепти користувача: ${username}</h3>
              <button onclick="closeUserRecipesModal()" class="close-btn">✕</button>
            </div>
            <div class="modal-body">
      `;

      if (userRecipes.length === 0) {
        html += '<p>У користувача немає рецептів.</p>';
      } else {
        userRecipes.forEach((recipe, index) => {
          const createdDate = new Date(recipe.createdAt).toLocaleDateString('uk-UA');
          html += `
            <div class="recipe-preview">
              <h4>${recipe.title}</h4>
              <p><strong>Створено:</strong> ${createdDate}</p>
              <p><strong>Інгредієнтів:</strong> ${recipe.ingredients.length}</p>
              <div class="recipe-actions">
                <button onclick="confirmDeleteUserRecipe(${userId}, ${index}, '${recipe.title}', '${username}')" class="danger-btn small">
                  🗑️ Видалити
                </button>
              </div>
            </div>
          `;
        });
      }

      html += `
            </div>
          </div>
        </div>
      `;

      // Додаємо модальне вікно до body
      const modal = document.createElement('div');
      modal.id = 'user-recipes-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = html;
      document.body.appendChild(modal);

      // Закриваємо модальне вікно при кліку на overlay
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeUserRecipesModal();
        }
      });
    };

    window.closeUserRecipesModal = function() {
      const modal = document.getElementById('user-recipes-modal');
      if (modal) {
        modal.remove();
      }
    };

    window.confirmDeleteUserRecipe = function(userId, recipeIndex, recipeTitle, username) {
      if (confirm(`Видалити рецепт "${recipeTitle}" користувача "${username}"?`)) {
        try {
          deleteUserRecipe(userId, recipeIndex);
          alert(`Рецепт "${recipeTitle}" успішно видалено.`);
          closeUserRecipesModal();
          renderAdminData();
        } catch (error) {
          alert('Помилка: ' + error.message);
        }
      }
    };

    // Функції роботи з рецептами
    function loadUserRecipes() {
      if (!currentUser) return;
      recipes = getFromStorage(`recipes_${currentUser.id}`) || [];
      console.log('Завантажено рецептів:', recipes.length);
    }

    function saveUserRecipes() {
      if (!currentUser) return;
      saveToStorage(`recipes_${currentUser.id}`, recipes);
      console.log('Збережено рецептів:', recipes.length);
    }

    function addIngredientRow() {
      const container = document.getElementById("ingredients-container");
      const row = document.createElement("div");
      row.className = "ingredient-row";
      row.innerHTML = `
        <input type="text" placeholder="Назва інгредієнта" class="ingredient-name" required />
        <input type="number" placeholder="грамів" class="ingredient-amount" required />
      `;
      container.appendChild(row);
    }

    function resetIngredientContainer() {
      const container = document.getElementById("ingredients-container");
      container.innerHTML = `
        <h4>Інгредієнти</h4>
        <div class="ingredient-row">
          <input type="text" placeholder="Назва інгредієнта" class="ingredient-name" required />
          <input type="number" placeholder="грамів" class="ingredient-amount" required />
        </div>
      `;
    }

    function handleRecipeSubmit(e) {
      e.preventDefault();
      console.log('Обробка форми рецепту');
      
      if (!currentUser) {
        alert('Помилка: користувач не авторизований');
        return;
      }

      const title = document.getElementById("title").value.trim();
      const instructions = document.getElementById("instructions").value.trim();
    
      const ingredientNames = document.querySelectorAll(".ingredient-name");
      const ingredientAmounts = document.querySelectorAll(".ingredient-amount");
    
      let ingredients = [];
    
      for (let i = 0; i < ingredientNames.length; i++) {
        const name = ingredientNames[i].value.trim();
        const amount = ingredientAmounts[i].value.trim();
        if (name && amount) {
          ingredients.push({ name, amount: parseFloat(amount) });
        }
      }
    
      if (!title || !ingredients.length || !instructions) {
        alert("Будь ласка, заповніть всі поля!");
        return;
      }

      const newRecipe = { 
        title, 
        ingredients, 
        instructions,
        author: currentUser.username,
        authorId: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editIndex !== null) {
        const originalRecipe = recipes[editIndex];
        newRecipe.author = originalRecipe.author;
        newRecipe.authorId = originalRecipe.authorId;
        newRecipe.createdAt = originalRecipe.createdAt;
        
        recipes[editIndex] = newRecipe;
        editIndex = null;
        document.getElementById("submit-btn").textContent = "Додати рецепт";
        console.log('Рецепт оновлено');
      } else {
        recipes.push(newRecipe);
        console.log('Новий рецепт додано');
      }

      saveUserRecipes();
      renderRecipes();
      e.target.reset();
      resetIngredientContainer();
      
      setTimeout(() => {
        const recipeList = document.getElementById("recipe-list");
        if (recipeList && recipeList.children.length > 0) {
          recipeList.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }

    function renderRecipes(filter = "") {
      const recipeList = document.getElementById("recipe-list");
      if (!recipeList) return;

      console.log('Рендер рецептів, всього:', recipes.length);

      recipeList.innerHTML = "";
      const filtered = recipes.filter(r =>
        r.title.toLowerCase().includes(filter.toLowerCase())
      );
      
      if (filtered.length === 0) {
        const noRecipesDiv = document.createElement("div");
        noRecipesDiv.style.cssText = "text-align: center; padding: 40px; color: #666; font-style: italic;";
        noRecipesDiv.innerHTML = filter ? 
          `<p>Не знайдено рецептів за запитом "${filter}"</p>` : 
          `<p>У вас поки немає рецептів. Додайте свій перший рецепт!</p>`;
        recipeList.appendChild(noRecipesDiv);
        return;
      }
      
      filtered.forEach((recipe, index) => {
        const recipeDiv = document.createElement("div");
        recipeDiv.className = "recipe";

        const createdDate = new Date(recipe.createdAt);
        const formattedDate = createdDate.toLocaleDateString('uk-UA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const wasUpdated = recipe.updatedAt && recipe.updatedAt !== recipe.createdAt;
        const updatedDate = wasUpdated ? new Date(recipe.updatedAt) : null;
        const formattedUpdatedDate = updatedDate ? updatedDate.toLocaleDateString('uk-UA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '';

        recipeDiv.innerHTML = `
          <h3 class="recipe-title">${recipe.title}</h3>
          <div class="recipe-meta">
            <small>
              Автор: <strong>${recipe.author || 'Невідомий'}</strong> • 
              Додано: ${formattedDate}
              ${wasUpdated ? ` • Оновлено: ${formattedUpdatedDate}` : ''}
            </small>
          </div>
          <div class="recipe-details hidden">
            <p><strong>Інгредієнти:</strong></p>
            <ul>
              ${recipe.ingredients.map(ing => `<li>${ing.name} — ${ing.amount} г</li>`).join("")}
            </ul>
            <p><strong>Інструкції:</strong> ${recipe.instructions}</p>
            <div class="action-buttons" style="margin-top: 15px;">
              <button class="edit-btn">✏️ Редагувати</button>
              <button class="delete-btn">🗑️ Видалити</button>
            </div>
          </div>
        `;

        const editBtn = recipeDiv.querySelector(".edit-btn");
        const deleteBtn = recipeDiv.querySelector(".delete-btn");
        const title = recipeDiv.querySelector(".recipe-title");
        const details = recipeDiv.querySelector(".recipe-details");

        editBtn.addEventListener("click", () => editRecipe(index));
        deleteBtn.addEventListener("click", () => deleteRecipe(index));
        title.addEventListener("click", () => details.classList.toggle("hidden"));

        recipeList.appendChild(recipeDiv);
      });
    }

    function deleteRecipe(index) {
      if (confirm("Ви впевнені, що хочете видалити цей рецепт?")) {
        recipes.splice(index, 1);
        saveUserRecipes();
        renderRecipes();
      }
    }

    function editRecipe(index) {
      const recipe = recipes[index];
      document.getElementById("title").value = recipe.title;
      document.getElementById("instructions").value = recipe.instructions;

      const container = document.getElementById("ingredients-container");
      container.innerHTML = `<h4>Інгредієнти</h4>`;
      recipe.ingredients.forEach(ing => {
        const row = document.createElement("div");
        row.className = "ingredient-row";
        row.innerHTML = `
          <input type="text" value="${ing.name}" class="ingredient-name" required />
          <input type="number" value="${ing.amount}" class="ingredient-amount" required />
        `;
        container.appendChild(row);
      });

      document.getElementById("submit-btn").textContent = "Зберегти зміни";
      editIndex = index;

      document.getElementById("add-form").scrollIntoView({ behavior: "smooth" });
    }

    function createAuthPage() {
      document.body.innerHTML = `
        <div class="auth-page">
          <div class="auth-container">
            <h2 style="text-align: center; margin-bottom: 30px; color: #333;">Вхід / Реєстрація</h2>
            
            <div class="auth-tabs">
              <button id="login-tab" class="tab-btn login-tab active">Вхід</button>
              <button id="register-tab" class="tab-btn register-tab">Реєстрація</button>
            </div>

            <form id="auth-form">
              <div id="register-fields" style="display: none;">
                <input type="email" id="email" placeholder="Email" style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
              </div>
              <input type="text" id="username" placeholder="Ім'я користувача" required style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
              <input type="password" id="password" placeholder="Пароль" required style="width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
              <button type="submit" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; font-size: 1em; cursor: pointer;">Увійти</button>
            </form>

            <div id="error-message" class="error-message" style="display: none;"></div>
            
            <div style="text-align: center; margin-top: 20px;">
              <button id="back-btn" style="background: #6c757d; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;">← Назад на головну</button>
            </div>
            
            <div style="text-align: center; margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 0.9em; color: #666;">
              💡 <strong>Підказка:</strong> Для отримання прав адміністратора використовуйте ім'я користувача: <code>admin</code>, <code>Administrator</code> або <code>адмін</code>
            </div>
          </div>
        </div>
      `;

      initAuthPage();
    }

    function initAuthPage() {
      const loginTab = document.getElementById('login-tab');
      const registerTab = document.getElementById('register-tab');
      const authForm = document.getElementById('auth-form');
      const registerFields = document.getElementById('register-fields');
      const submitBtn = authForm.querySelector('button[type="submit"]');
      const errorMessage = document.getElementById('error-message');
      const backBtn = document.getElementById('back-btn');

      let isLoginMode = true;

      loginTab.addEventListener('click', () => {
        isLoginMode = true;
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        registerFields.style.display = 'none';
        submitBtn.textContent = 'Увійти';
        errorMessage.style.display = 'none';
      });

      registerTab.addEventListener('click', () => {
        isLoginMode = false;
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerFields.style.display = 'block';
        submitBtn.textContent = 'Зареєструватися';
        errorMessage.style.display = 'none';
      });

      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const email = document.getElementById('email').value.trim();

        try {
          if (isLoginMode) {
            login(username, password);
          } else {
            if (!email) {
              throw new Error('Email є обов\'язковим для реєстрації');
            }
            register(username, email, password);
            login(username, password);
          }

          location.reload();
        } catch (error) {
          errorMessage.textContent = error.message;
          errorMessage.style.display = 'block';
        }
      });

      backBtn.addEventListener('click', () => {
        location.reload();
      });
    }

    // Ініціалізація
    document.addEventListener("DOMContentLoaded", () => {
      console.log('DOM завантажено');
      
      // Додаємо кнопку адміністратора до header
      const headerButtons = document.querySelector('.header-buttons');
      if (headerButtons && !document.getElementById('admin-btn')) {
        const adminBtn = document.createElement('button');
        adminBtn.id = 'admin-btn';
        adminBtn.className = 'auth-button hidden';
        adminBtn.textContent = '🛡️ Адмін панель';
        adminBtn.addEventListener('click', showAdminInterface);
        headerButtons.insertBefore(adminBtn, document.getElementById('logout-btn'));
      }
      
      // Перевіряємо збережену сесію
      const savedUser = getFromStorage('currentUser');
      if (savedUser) {
        // Оновлюємо статус адміністратора
        savedUser.isAdmin = isAdmin(savedUser);
        currentUser = savedUser;
        saveToStorage('currentUser', savedUser);
        showUserInterface();
      } else {
        showGuestInterface();
      }

      // Додаємо обробники подій
      document.getElementById('auth-btn').addEventListener('click', createAuthPage);
      document.getElementById('logout-btn').addEventListener('click', logout);

      // Обробники для форми рецептів
      const addForm = document.getElementById("add-recipe-form");
      if (addForm) {
        addForm.addEventListener("submit", handleRecipeSubmit);
      }

      const searchInput = document.getElementById("search");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          renderRecipes(e.target.value);
        });
      }

      const addIngredientBtn = document.getElementById("add-ingredient-btn");
      if (addIngredientBtn) {
        addIngredientBtn.addEventListener("click", addIngredientRow);
      }
    });