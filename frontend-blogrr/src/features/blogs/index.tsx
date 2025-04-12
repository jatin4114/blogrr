// Types for blog and comment data
interface User {
    id: number;
    username: string;
  }
  
  interface Comment {
    id: number;
    text: string;
    user: User;
    created_at: string;
  }
  
  interface Blog {
    id: number;
    title: string;
    body: string;
    category: string;
    creator_id: number;
    creator: User;
    created_at: string;
    comments?: Comment[];
  }
  
  interface FilterOptions {
    categoryFilter?: string;
    dateFilter?: string;
    sortBy?: string;
  }
  
  // Declare global functions outside of setupApp
  // These will be the actual implementations assigned to window
  function openEditPopup(blog: Blog): void {
    // Implementation will be set in setupApp
    console.warn("Function not initialized");
  }
  
  async function deleteBlog(blogId: number): Promise<void> {
    // Implementation will be set in setupApp
    console.warn("Function not initialized");
  }
  
  function toggleComments(blogId: number): void {
    // Implementation will be set in setupApp
    console.warn("Function not initialized");
  }
  
  async function addComment(event: Event, blogId: number, isModal: boolean = false): Promise<void> {
    // Implementation will be set in setupApp
    console.warn("Function not initialized");
  }
  
  function showLoginForm(): void {
    // Implementation will be set in setupApp
    console.warn("Function not initialized");
  }
  
  function showRegisterForm(): void {
    // Implementation will be set in setupApp
    console.warn("Function not initialized");
  }
  
  function openCreateBlogPopup(): void {
    // Implementation will be set in setupApp
    console.warn("Function not initialized");
  }
  
  // Auth state
  let currentUser: User | null = null;
  let currentView: 'auth' | 'myBlogs' | 'explore' = 'auth';
  let hasShownWelcome: boolean = false;
  
  // API base URL from environment
  const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  // Update global interfaces
  declare global {
    interface Window {
      setupApp: typeof setupApp;
      openEditPopup: typeof openEditPopup;
      deleteBlog: typeof deleteBlog;
      toggleComments: typeof toggleComments;
      addComment: typeof addComment;
      showLoginForm: typeof showLoginForm;
      showRegisterForm: typeof showRegisterForm;
      openCreateBlogPopup: typeof openCreateBlogPopup;
      scrollTimer: Timer; // Changed from NodeJS.Timeout
    }
  }
  
  export function setupApp(): void {
    // DOM Elements
    const loginForm: HTMLFormElement | null = document.getElementById('login-form') as HTMLFormElement | null;
    const registerForm: HTMLFormElement | null = document.getElementById('register-form') as HTMLFormElement | null;
    const topbar: HTMLElement | null = document.getElementById('topbar');
    const authContainer: HTMLElement | null = document.getElementById('auth-container');
    const blogsContainer: HTMLElement | null = document.getElementById('blogs-container');
    const logoutBtn: HTMLElement | null = document.getElementById('logout-btn');
    const exploreBtn: HTMLElement | null = document.getElementById('explore-btn');
    const profileBtn: HTMLElement | null = document.getElementById('profile-btn');
    const createBlogBtn: HTMLElement | null = document.getElementById('create-blog-btn');
    const filterToggle: HTMLButtonElement = document.createElement('button');
    filterToggle.className = 'filter-toggle';
    filterToggle.innerHTML = '<i class="fas fa-sliders-h"></i> Filters';
    document.body.appendChild(filterToggle);
  
    // Update menu toggle functionality
    const menuToggle: HTMLElement | null = document.getElementById('menu-toggle');
    const navMenu: HTMLElement | null = document.getElementById('nav-menu');
    let isMenuOpen: boolean = false;
  
    if (menuToggle && navMenu) {
      menuToggle.addEventListener('click', (e: Event) => {
        e.stopPropagation(); // Prevent event bubbling
        isMenuOpen = !isMenuOpen;
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('show');
      });
  
      // Close menu when clicking outside
      document.addEventListener('click', (e: MouseEvent) => {
        if (isMenuOpen && !menuToggle.contains(e.target as Node) && !navMenu.contains(e.target as Node)) {
          isMenuOpen = false;
          menuToggle.classList.remove('active');
          navMenu.classList.remove('show');
        }
      });
  
      // Close menu when a nav item is clicked
      navMenu.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          isMenuOpen = false;
          menuToggle.classList.remove('active');
          navMenu.classList.remove('show');
        });
      });
    }
  
    // Add escape key handler - FIX: added null checks
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen && menuToggle && navMenu) {
        isMenuOpen = false;
        menuToggle.classList.remove('active');
        navMenu.classList.remove('show');
      }
    });
  
    // Define all functions first
    async function deleteBlog(blogId: number) {
      if (!confirm('Are you sure you want to delete this blog?')) {
        return;
      }
  
      try {
        const response = await fetch(`${API_BASE_URL}/blogs/${blogId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
  
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to delete blog');
        }
  
        // Reload blogs after successful deletion
        loadBlogs(currentView === 'explore' ? 'explore' : 'my');
      } catch (error) {
        console.error('Delete error:', error);
        alert((error as Error).message);
      }
    }
  
    function openEditPopup(blog: Blog) {
      const popup = document.createElement('div');
      popup.className = 'edit-popup';
      popup.innerHTML = `
        <div class="edit-popup-content">
          <div class="popup-header">
            <h3>Edit Blog</h3>
            <button class="close-popup"><i class="fas fa-times"></i></button>
          </div>
          <form id="edit-blog-form">
            <div class="form-group">
              <label for="edit-title">
                <i class="fas fa-heading"></i> Title
              </label>
              <input type="text" id="edit-title" value="${blog.title}" required>
            </div>
            <div class="form-group">
              <label for="edit-content">
                <i class="fas fa-pen"></i> Content
              </label>
              <textarea id="edit-content" required>${blog.body}</textarea>
            </div>
            <button type="submit" class="btn">
              <i class="fas fa-save"></i> Save Changes
            </button>
          </form>
        </div>
      `;
  
      document.body.appendChild(popup);
  
      // Close popup handler
      const closeBtn = popup.querySelector('.close-popup') as HTMLElement;
      closeBtn.onclick = () => popup.remove();
  
      // Handle click outside
      popup.onclick = (e: MouseEvent) => {
        if (e.target === popup) popup.remove();
      };
  
      // Handle form submission
      const editForm = popup.querySelector('#edit-blog-form') as HTMLFormElement;
      editForm.onsubmit = async (e: Event) => {
        e.preventDefault();
        const title = (editForm.querySelector('#edit-title') as HTMLInputElement).value;
        const content = (editForm.querySelector('#edit-content') as HTMLTextAreaElement).value;
  
        try {
          const response = await fetch(`${API_BASE_URL}/blogs/${blog.id}/update`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              title,
              body: content,
              category: blog.category
            })
          });
  
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update blog');
          }
  
          popup.remove();
          loadBlogs(currentView === 'explore' ? 'explore' : 'my');
        } catch (error) {
          alert((error as Error).message);
        }
      };
    }
  
    function toggleComments(blogId: number) {
      const commentsSection = document.getElementById(`comments-${blogId}`) as HTMLElement;
      commentsSection.classList.toggle('clicked');
      commentsSection.classList.toggle('active');
  
      if (!commentsSection.classList.contains('clicked')) {
        setTimeout(() => {
          if (!commentsSection.classList.contains('clicked')) {
            commentsSection.style.display = 'none';
          }
        }, 300);
      } else {
        commentsSection.style.display = 'block';
      }
    }
  
    async function addComment(event: Event, blogId: number, isModal = false) {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      const input = form.querySelector('input') as HTMLInputElement;
      const comment = input.value.trim();
  
      try {
        const response = await fetch(`${API_BASE_URL}/comments/${blogId}/add-comment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ text: comment })
        });
  
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to add comment');
        }
  
        // Clear input and reload blogs to show new comment
        input.value = '';
        if (isModal) {
          // Reload the entire blog to update comments in modal
          const blogResponse = await fetch(`${API_BASE_URL}/blogs/${blogId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          const blog = await blogResponse.json();
  
          // Update comments section in modal
          const modalCommentsList = document.querySelector('.modal-comments-list') as HTMLElement;
          const comments = blog.comments || [];
          modalCommentsList.innerHTML = comments.map((comment: Comment) => `
            <div class="modal-comment">
              <div class="modal-comment-header">
                <div class="modal-comment-author">
                  <i class="fas fa-user-circle"></i>
                  <span>${comment.user.username}</span>
                </div>
                <small>${new Date(comment.created_at).toLocaleDateString()}</small>
              </div>
              <p>${comment.text}</p>
            </div>
          `).join('');
        } else {
          loadBlogs(currentView === 'explore' ? 'explore' : 'my');
        }
      } catch (error) {
        alert((error as Error).message);
      }
    }
  
    // Auth Functions
    async function register(event: Event) {
      event.preventDefault();
      const username = (document.getElementById('register-username') as HTMLInputElement).value;
      const email = (document.getElementById('register-email') as HTMLInputElement).value;
      const password = (document.getElementById('register-password') as HTMLInputElement).value;
  
      try {
        const response = await fetch(`${API_BASE_URL}/users/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
  
        if (response.ok) {
          alert('Registration successful! Please login.');
          showLoginForm();
          // Clear form
          registerForm?.reset();
        } else {
          throw new Error(data.detail || 'Registration failed');
        }
      } catch (error) {
        alert((error as Error).message);
        if ((error as Error).message.includes('Username already registered')) {
          (document.getElementById('register-username') as HTMLInputElement).value = '';
        }
        if ((error as Error).message.includes('Email already registered')) {
          (document.getElementById('register-email') as HTMLInputElement).value = '';
        }
      }
    }
  
    async function login(event: Event) {
      event.preventDefault();
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
  
      try {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
  
        const response = await fetch(`${API_BASE_URL}/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: formData
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.detail || 'Login failed');
        }
  
        // Store user data
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('userId', data.user_id);
        localStorage.setItem('username', data.username);
  
        // Show blogs page
        showBlogsPage();
        loginForm?.reset();
      } catch (error) {
        console.error('Login error:', error);
        alert((error as Error).message);
        (document.getElementById('login-password') as HTMLInputElement).value = '';
      }
    }
  
    function logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      currentUser = null;
      filterToggle.style.display = 'none'; // Hide filter toggle on logout
      const filterPanel = document.querySelector('.sort-filter-panel');
      if (filterPanel) {
        filterPanel.classList.remove('show');
      }
      showAuthPage();
    }
  
    // UI Functions
    function showLoginForm() {
      const loginSection = document.getElementById('login-section');
      const registerSection = document.getElementById('register-section');
      const loginTab = document.getElementById('login-tab');
      const registerTab = document.getElementById('register-tab');
  
      if (loginSection) loginSection.classList.add('active');
      if (registerSection) registerSection.classList.remove('active');
      if (loginTab) loginTab.classList.add('active');
      if (registerTab) registerTab.classList.remove('active');
    }
  
    function showRegisterForm() {
      const loginSection = document.getElementById('login-section');
      const registerSection = document.getElementById('register-section');
      const loginTab = document.getElementById('login-tab');
      const registerTab = document.getElementById('register-tab');
  
      if (registerSection) registerSection.classList.add('active');
      if (loginSection) loginSection.classList.remove('active');
      if (registerTab) registerTab.classList.add('active');
      if (loginTab) loginTab.classList.remove('active');
    }
  
    function showAuthPage() {
      topbar?.classList.add('hidden');
      authContainer?.classList.remove('hidden');
      blogsContainer?.classList.add('hidden');
      filterToggle.style.display = 'none'; // Hide filter toggle
      const welcomeBanner = document.getElementById('welcome-banner');
      if (welcomeBanner) {
        welcomeBanner.classList.add('hidden');
      }
      // Also hide the filter panel if it exists
      const filterPanel = document.querySelector('.sort-filter-panel');
      if (filterPanel) {
        filterPanel.classList.remove('show');
      }
    }
  
    function displaySortFilterPanel(show: boolean) {
      let panel = document.querySelector('.sort-filter-panel') as HTMLElement;
  
      if (show) {
        if (!panel) {
          panel = document.createElement('div');
          panel.className = 'sort-filter-panel';
          panel.innerHTML = `
            <div class="active-filters">0</div>
            <div class="filter-section">
              <h3><i class="fas fa-filter"></i> Filter</h3>
              <div class="filter-group">
                <label>By Category</label>
                <select id="category-filter">
                  <option value="all">All Categories</option>
                  <option value="general">General</option>
                  <option value="technology">Technology</option>
                  <option value="lifestyle">Lifestyle</option>
                  <option value="travel">Travel</option>
                  <option value="food">Food</option>
                </select>
              </div>
              <div class="filter-group">
                <label>By Date</label>
                <select id="date-filter">
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
            <div class="sort-section">
              <h3><i class="fas fa-sort"></i> Sort</h3>
              <div class="sort-group">
                <label>Sort By</label>
                <select id="sort-by">
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="comments">Most Comments</option>
                </select>
              </div>
            </div>
          `;
          document.body.appendChild(panel);
  
          // Add event listeners
          document.getElementById('category-filter')?.addEventListener('change', applyFilters);
          document.getElementById('date-filter')?.addEventListener('change', applyFilters);
          document.getElementById('sort-by')?.addEventListener('change', applyFilters);
        }
  
        // Show panel with animation
        requestAnimationFrame(() => {
          panel.classList.add('show');
          filterToggle.classList.add('active');
        });
      } else {
        if (panel) {
          panel.classList.remove('show');
          filterToggle.classList.remove('active');
        }
      }
    }
  
    function applyFilters() {
      const categoryFilter = (document.getElementById('category-filter') as HTMLSelectElement).value;
      const dateFilter = (document.getElementById('date-filter') as HTMLSelectElement).value;
      const sortBy = (document.getElementById('sort-by') as HTMLSelectElement).value;
  
      // Count active filters
      const activeCount = [categoryFilter, dateFilter].filter(filter => filter !== 'all').length;
      const activeFilters = document.querySelector('.active-filters') as HTMLElement;
  
      if (activeCount > 0) {
        activeFilters.textContent = activeCount.toString();
        activeFilters.classList.add('show');
      } else {
        activeFilters.classList.remove('show');
      }
  
      loadBlogs('explore', { categoryFilter, dateFilter, sortBy });
    }
  
    // Update the showWelcomeBanner function
    function showWelcomeBanner() {
      const welcomeBanner = document.getElementById('welcome-banner');
      if (welcomeBanner && !hasShownWelcome) {
        hasShownWelcome = true; // Set flag to true
        welcomeBanner.classList.remove('hidden');
  
        // Small delay to ensure DOM update before animation
        requestAnimationFrame(() => {
          welcomeBanner.classList.add('show');
  
          // Auto hide after 4 seconds
          setTimeout(() => {
            welcomeBanner.classList.remove('show');
            welcomeBanner.classList.add('hide');
  
            // Remove from DOM after animation completes
            setTimeout(() => {
              welcomeBanner.classList.add('hidden');
              welcomeBanner.classList.remove('hide');
            }, 800); // Increased from 500ms for smoother transition
          }, 2000);
        });
      }
    }
  
    // Update the showBlogsPage function
    function showBlogsPage(type: 'my' | 'explore' = 'my') {
      // First fade out current content
      const blogsGrid = document.getElementById('blogs-grid') as HTMLElement;
      const welcomeBanner = document.getElementById('welcome-banner');
  
      // Add fade out animation
      blogsGrid.style.opacity = '0';
      blogsGrid.style.transform = 'translateY(20px)';
  
      // Wait for fade out animation
      setTimeout(() => {
        currentView = type === 'explore' ? 'explore' : 'myBlogs';
  
        // Update UI elements
        topbar?.classList.remove('hidden');
        authContainer?.classList.add('hidden');
        blogsContainer?.classList.remove('hidden');
  
        // Update username in topbar
        const topbarUsername = document.getElementById('topbar-username');
        if (topbarUsername) {
          topbarUsername.textContent = localStorage.getItem('username');
        }
  
        // Show/hide filter toggle based on view
        filterToggle.style.display = type === 'explore' ? 'flex' : 'none';
  
        // Update welcome banner
        if (welcomeBanner) {
          if (type === 'my' && !hasShownWelcome) {
            showWelcomeBanner();
          } else {
            welcomeBanner.classList.add('hidden');
          }
        }
  
        // Load new content
        loadBlogs(type).then(() => {
          // Fade in the new content
          requestAnimationFrame(() => {
            blogsGrid.style.opacity = '1';
            blogsGrid.style.transform = 'translateY(0)';
          });
        });
  
        // Update active state of buttons
        exploreBtn?.classList.toggle('active', type === 'explore');
        profileBtn?.classList.toggle('active', type === 'my');
      }, 300); // Match this with CSS transition duration
    }
  
    // Separate function to handle loading and displaying blogs
    async function loadAndDisplayBlogs(type: 'my' | 'explore') {
      const blogsGrid = document.getElementById('blogs-grid') as HTMLElement;
      blogsGrid.classList.add('fade');
  
      await loadBlogs(type);
  
      // Fade in the blogs
      setTimeout(() => {
        blogsGrid.classList.remove('fade');
      }, 50);
    }
  
    async function loadBlogs(type: 'my' | 'explore' = 'my', filters: FilterOptions = {}) {
      try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/blogs/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to load blogs');
        }
  
        let blogs: Blog[] = await response.json();
  
        // Filter blogs based on type
        blogs = type === 'explore'
          ? blogs.filter(blog => blog.creator_id !== parseInt(userId!))
          : blogs.filter(blog => blog.creator_id === parseInt(userId!));
  
        // Apply additional filters for explore view
        if (type === 'explore' && filters) {
          // Category filtering
          if (filters.categoryFilter && filters.categoryFilter !== 'all') {
            blogs = blogs.filter(blog => blog.category.toLowerCase() === filters.categoryFilter!.toLowerCase());
          }
  
          // Date filtering
          if (filters.dateFilter && filters.dateFilter !== 'all') {
            const now = new Date();
            const filterDate = new Date();
  
            switch (filters.dateFilter) {
              case 'today':
                filterDate.setHours(0, 0, 0, 0);
                break;
              case 'week':
                filterDate.setDate(filterDate.getDate() - 7);
                break;
              case 'month':
                filterDate.setMonth(filterDate.getMonth() - 1);
                break;
            }
  
            blogs = blogs.filter(blog => new Date(blog.created_at) >= filterDate);
          }
  
          // Sorting
          if (filters.sortBy) {
            switch (filters.sortBy) {
              case 'newest':
                blogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                break;
              case 'oldest':
                blogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                break;
              case 'comments':
                blogs.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
                break;
            }
          }
        }
  
        displayBlogs(blogs, type);
      } catch (error) {
        console.error('Error loading blogs:', error);
        alert('Failed to load blogs');
      }
    }
  
    function displayBlogs(blogs: Blog[], type: 'my' | 'explore') {
      const blogsGrid = document.getElementById('blogs-grid') as HTMLElement;
      const blogsTitle = document.querySelector('.blogs-container h2') as HTMLElement;
      const blogsSubtitle = document.querySelector('.blogs-subtitle') as HTMLElement;
  
      // Update title based on view
      blogsTitle.textContent = type === 'explore' ? 'Explore' : 'My Blogs';
  
      // Add inspirational subtitle
      const exploreQuotes = [
        "Discover stories that inspire, challenge, and connect.",
        "Explore new perspectives, one story at a time.",
        "Find your next favorite read in our community.",
        "Join the conversation, discover new voices.",
        "Where great minds share their stories."
      ];
  
      const createQuotes = [
        "Your story matters. Share it with the world.",
        "Turn your thoughts into words, your words into impact.",
        "Create, inspire, and leave your mark.",
        "Every great writer started with a single post.",
        "Your unique voice deserves to be heard."
      ];
  
      // Randomly select a quote
      const quotes = type === 'explore' ? exploreQuotes : createQuotes;
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  
      // Update or create subtitle
      if (!blogsSubtitle) {
        const subtitle = document.createElement('p');
        subtitle.className = 'blogs-subtitle';
        subtitle.textContent = randomQuote;
        blogsTitle.parentNode?.insertBefore(subtitle, blogsTitle.nextSibling);
      } else {
        blogsSubtitle.textContent = randomQuote;
      }
  
      if (blogs.length === 0) {
        blogsGrid.innerHTML = `
          <div class="no-blogs-message">
            ${type === 'explore'
            ? 'No blogs from other users yet.'
            : 'You haven\'t created any blogs yet.'}
          </div>`;
        return;
      }
  
      blogsGrid.innerHTML = blogs.map(blog => {
        const isAuthor = parseInt(localStorage.getItem('userId')!) === blog.creator_id;
        const comments = blog.comments || [];
  
        return `
          <div class="blog-wrapper">
            <div class="blog-card ${type === 'explore' ? 'floating' : ''}">
              <div class="blog-category">
                <i class="fas fa-tag"></i> ${blog.category}
              </div>
              <div class="blog-content">
                <h3>${blog.title}</h3>
                <p>${blog.body}</p>
              </div>
              <div class="blog-footer">
                <div class="blog-meta">
                  <div class="author-info">
                    <i class="fas fa-user-circle"></i>
                    <span>${blog.creator.username}</span>
                  </div>
                  <small>${new Date(blog.created_at).toLocaleDateString()}</small>
                </div>
                <div class="blog-actions">
                  ${isAuthor ? `
                    <button onclick="window.openEditPopup(${JSON.stringify(blog).replace(/"/g, '&quot;')})" class="action-btn edit-btn">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="window.deleteBlog(${blog.id})" class="action-btn delete-btn">
                      <i class="fas fa-trash"></i>
                    </button>
                  ` : `
                    <button onclick="window.toggleComments(${blog.id})" class="action-btn comment-btn">
                      <i class="fas fa-comment"></i>
                      <span class="comment-count">${comments.length}</span>
                    </button>
                  `}
                </div>
              </div>
            </div>
            <div class="comments-section" id="comments-${blog.id}">
              <div class="comments-list">
                ${comments.length > 0 ? comments.map(comment => `
                  <div class="comment">
                    <div class="comment-header">
                      <div class="comment-author">
                        <i class="fas fa-user-circle"></i>
                        <span>${comment.user.username}</span>
                      </div>
                      <small>${new Date(comment.created_at).toLocaleDateString()}</small>
                    </div>
                    <p>${comment.text}</p>
                  </div>
                `).join('') : '<p class="no-comments">No comments yet. Be the first to comment!</p>'}
              </div>
              <form onsubmit="window.addComment(event, ${blog.id})" class="comment-form">
                <input type="text" placeholder="Add a comment..." required>
                <button type="submit" class="comment-submit">
                  <i class="fas fa-paper-plane"></i>
                </button>
              </form>
            </div>
          </div>
        `;
      }).join('');
  
      // After the blogs are rendered, add hover functionality
      const blogWrappers = document.querySelectorAll('.blog-wrapper');
      blogWrappers.forEach(wrapper => {
        const commentBtn = wrapper.querySelector('.comment-btn') as HTMLElement;
        const commentsSection = wrapper.querySelector('.comments-section') as HTMLElement;
    
        if (commentBtn && commentsSection) {
          let isHovered = false;
          let timeoutId: Timer | null = null; // Changed from NodeJS.Timeout
    
          // Show on hover over comment button
          commentBtn.addEventListener('mouseenter', () => {
            isHovered = true;
            clearTimeout(timeoutId!);
            commentsSection.style.display = 'block';
            setTimeout(() => {
              commentsSection.classList.add('active');
            }, 10);
          });
    
          // Keep visible when hovering over comments section
          commentsSection.addEventListener('mouseenter', () => {
            isHovered = true;
            clearTimeout(timeoutId!);
          });
    
          // Hide when mouse leaves comment button
          commentBtn.addEventListener('mouseleave', () => {
            isHovered = false;
            handleMouseLeave();
          });
    
          // Hide when mouse leaves comments section
          commentsSection.addEventListener('mouseleave', () => {
            isHovered = false;
            handleMouseLeave();
          });
    
          function handleMouseLeave() {
            timeoutId = setTimeout(() => {
              if (!isHovered && !commentsSection.classList.contains('clicked')) {
                commentsSection.classList.remove('active');
                setTimeout(() => {
                  if (!isHovered) {
                    commentsSection.style.display = 'none';
                  }
                }, 300);
              }
            }, 100);
          }
        }
      });
  
      // After the blogs are rendered, add click handlers
      const blogCards = document.querySelectorAll('.blog-card');
      blogCards.forEach((card, index) => {
        card.addEventListener('click', (e: Event) => {
          const target = e.target as HTMLElement;
          // Don't open modal if clicking action buttons
          if (!target.closest('.blog-actions')) {
            openBlogModal(blogs[index]);
          }
        });
      });
    }
  
    // Event Listeners
    if (loginForm) loginForm.addEventListener('submit', login);
    if (registerForm) registerForm.addEventListener('submit', register);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  
    if (exploreBtn) {
      exploreBtn.addEventListener('click', () => {
        if (currentView !== 'explore') {
          showBlogsPage('explore');
        }
      });
    }
  
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        if (currentView !== 'myBlogs') {
          showBlogsPage('my');
        }
      });
    }
  
    // Add this function after the other UI functions
    function openCreateBlogPopup() {
      const popup = document.createElement('div');
      popup.className = 'edit-popup';
      popup.innerHTML = `
        <div class="edit-popup-content">
          <div class="popup-header">
            <h3><i class="fas fa-plus-circle"></i> Create New Blog</h3>
            <button class="close-popup"><i class="fas fa-times"></i></button>
          </div>
          <form id="create-blog-form">
            <div class="form-group">
              <label for="create-title">
                <i class="fas fa-heading"></i> Title
              </label>
              <input type="text" id="create-title" required placeholder="Enter blog title">
            </div>
            <div class="form-group">
              <label for="create-category">
                <i class="fas fa-tag"></i> Category
              </label>
              <select id="create-category" required>
                <option value="general">General</option>
                <option value="technology">Technology</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="travel">Travel</option>
                <option value="food">Food</option>
              </select>
            </div>
            <div class="form-group">
              <label for="create-content">
                <i class="fas fa-pen"></i> Content
              </label>
              <textarea id="create-content" required placeholder="Write your blog content here..."></textarea>
            </div>
            <button type="submit" class="btn">
              <i class="fas fa-paper-plane"></i> Publish Blog
            </button>
          </form>
        </div>
      `;
  
      document.body.appendChild(popup);
  
      // Close popup handler
      const closeBtn = popup.querySelector('.close-popup') as HTMLElement;
      closeBtn.onclick = () => popup.remove();
  
      // Handle click outside
      popup.onclick = (e: MouseEvent) => {
        if (e.target === popup) popup.remove();
      };
  
      // Handle form submission
      const createForm = popup.querySelector('#create-blog-form') as HTMLFormElement;
      createForm.onsubmit = async (e: Event) => {
        e.preventDefault();
        const title = (createForm.querySelector('#create-title') as HTMLInputElement).value;
        const content = (createForm.querySelector('#create-content') as HTMLTextAreaElement).value;
        const category = (createForm.querySelector('#create-category') as HTMLSelectElement).value;
  
        try {
          const response = await fetch(`${API_BASE_URL}/blogs/new`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              title,
              body: content,
              category
            })
          });
  
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create blog');
          }
  
          popup.remove();
          loadBlogs('my');
        } catch (error) {
          alert((error as Error).message);
        }
      };
    }
  
    // Add event listener for create blog button
    if (createBlogBtn) {
      createBlogBtn.addEventListener('click', openCreateBlogPopup);
    }
  
    // Add filter toggle event listener
    filterToggle.addEventListener('click', () => {
      const panel = document.querySelector('.sort-filter-panel');
      if (panel && panel.classList.contains('show')) {
        displaySortFilterPanel(false);
      } else {
        displaySortFilterPanel(true);
      }
    });
  
    // Make functions globally available
    window.openEditPopup = openEditPopup;
    window.deleteBlog = deleteBlog;
    window.toggleComments = toggleComments;
    window.addComment = addComment;
    window.showLoginForm = showLoginForm;
    window.showRegisterForm = showRegisterForm;
    window.openCreateBlogPopup = openCreateBlogPopup;
  
    // Check for OAuth callback before initializing app
    if (!handleOAuthCallback()) {
      // Initial check for logged-in user (only if not already handling a callback)
      const token = localStorage.getItem('token');
      if (token) {
        showBlogsPage();
      } else {
        showAuthPage();
      }
    }
  
    // Add this function to handle blog expansion
    function openBlogModal(blog: Blog) {
      const comments = blog.comments || [];
      const modal = document.createElement('div');
      modal.className = 'blog-modal';
      modal.innerHTML = `
        <div class="blog-modal-content">
          <div class="blog-modal-header">
            <div>
              <h2 class="blog-modal-title">${blog.title}</h2>
              <div class="blog-modal-category">
                <i class="fas fa-tag"></i> ${blog.category}
              </div>
            </div>
            <button class="close-modal">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="blog-modal-body">
            ${blog.body}
          </div>
          <div class="blog-modal-footer">
            <div class="modal-author-info">
              <div class="modal-author-avatar">
                <i class="fas fa-user"></i>
              </div>
              <div>
                <strong>${blog.creator.username}</strong>
                <div><small>${new Date(blog.created_at).toLocaleDateString()}</small></div>
              </div>
            </div>
          </div>
          <div class="modal-comments-section">
            <h3><i class="fas fa-comments"></i> Comments (${comments.length})</h3>
            <div class="modal-comments-list">
              ${comments.length > 0 ? comments.map(comment => `
                <div class="modal-comment">
                  <div class="modal-comment-header">
                    <div class="modal-comment-author">
                      <i class="fas fa-user-circle"></i>
                      <span>${comment.user.username}</span>
                    </div>
                    <small>${new Date(comment.created_at).toLocaleDateString()}</small>
                  </div>
                  <p>${comment.text}</p>
                </div>
              `).join('') : '<p class="no-comments">No comments yet. Be the first to comment!</p>'}
            </div>
            <form class="modal-comment-form" onsubmit="event.preventDefault(); window.addComment(event, ${blog.id}, true)">
              <input type="text" placeholder="Add a comment..." required>
              <button type="submit" class="comment-submit">
                <i class="fas fa-paper-plane"></i>
              </button>
            </form>
          </div>
        </div>
      `;
  
      document.body.appendChild(modal);
  
      // Add slight delay to trigger animation
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });
  
      // Close modal handlers
      const closeBtn = modal.querySelector('.close-modal') as HTMLElement;
      closeBtn.onclick = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
      };
  
      // Close on escape key
      document.addEventListener('keydown', function (e: KeyboardEvent) {
        if (e.key === 'Escape') {
          closeBtn.click();
        }
      });
  
      // Close on click outside
      modal.addEventListener('click', function (e: MouseEvent) {
        if (e.target === modal) {
          closeBtn.click();
        }
      });
    }
  
    // Add scroll blur effect to background shapes
    document.addEventListener('scroll', () => {
      const shapes = document.querySelector('.background-shapes') as HTMLElement;
      if (shapes) {
        shapes.classList.add('scrolling');
        clearTimeout(window.scrollTimer);
        window.scrollTimer = setTimeout(() => {
          shapes.classList.remove('scrolling');
        }, 150);
      }
    });
  
    // Mobile navigation buttons
    const mobileExploreBtn = document.getElementById('mobile-explore-btn');
    const mobileProfileBtn = document.getElementById('mobile-profile-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
  
    if (mobileExploreBtn) {
      mobileExploreBtn.addEventListener('click', () => {
        showBlogsPage('explore');
        closeMenu();
      });
    }
  
    if (mobileProfileBtn) {
      mobileProfileBtn.addEventListener('click', () => {
        showBlogsPage('my');
        closeMenu();
      });
    }
  
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener('click', () => {
        logout();
        closeMenu();
      });
    }
  
    function closeMenu() {
      const menuToggle = document.getElementById('menu-toggle') as HTMLElement;
      const navMenu = document.getElementById('nav-menu') as HTMLElement;
      menuToggle.classList.remove('active');
      navMenu.classList.remove('show');
    }
  
    // Google OAuth Login Function
    async function initiateGoogleLogin() {
      try {
        console.log('Initiating Google login...');
        // Get Google auth URL from backend using POST method
        const response = await fetch(`${API_BASE_URL}/users/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({})  // Empty body but required for POST
        });
  
        if (!response.ok) {
          const error = await response.json();
          console.error('OAuth initiation error:', error);
          throw new Error(error.detail || 'Failed to initiate Google login');
        }
  
        const data = await response.json();
  
        // Check if auth_url is present in response
        if (!data.auth_url) {
          throw new Error('Invalid response: No authorization URL received');
        }
  
        console.log('Redirecting to Google login...');
        // Redirect to Google login
        window.location.href = data.auth_url;
      } catch (error) {
        console.error('Google login error:', error);
        alert('Failed to connect to Google login. Please try again. Details: ' + (error as Error).message);
      }
    }
  
    // Handle OAuth callback
    function handleOAuthCallback(): boolean {
      console.log('Checking for OAuth callback data...');
      const params = new URLSearchParams(window.location.search);
  
      // Extract user data from query parameters
      const accessToken = params.get('access_token');
      const userId = params.get('user_id');
      const username = params.get('username');
  
      // Check if we have the required OAuth parameters
      if (accessToken && userId && username) {
        console.log('OAuth callback detected, processing login...');
  
        // Store user data in localStorage
        localStorage.setItem('token', accessToken);
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
  
        // Clean the URL by removing the OAuth parameters
        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
  
        // Show the blogs page
        showBlogsPage('my');
  
        // Update username display in welcome banner
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay) {
          usernameDisplay.textContent = username;
        }
  
        // Also update username in topbar
        const topbarUsername = document.getElementById('topbar-username');
        if (topbarUsername) {
          topbarUsername.textContent = username;
        }
  
        return true; // Indicate we handled a callback
      }
  
      // Check for OAuth errors
      const error = params.get('error');
      if (error) {
        const errorDesc = params.get('error_description') || 'Unknown error';
        alert(`Login failed: ${errorDesc}`);
        return true; // We handled an error callback
      }
  
      return false; // No callback was handled
    }
  
    // Add Google login button event listener
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', initiateGoogleLogin);
    }
  
    // Check for OAuth callback before initializing app
    if (!handleOAuthCallback()) {
      // Initial check for logged-in user (only if not already handling a callback)
      const token = localStorage.getItem('token');
      if (token) {
        showBlogsPage();
      } else {
        showAuthPage();
      }
    }
  }
  
  // Add your existing global functions needed for window object
  declare global {
    interface Window {
      setupApp: typeof setupApp;
      openEditPopup: (blog: Blog) => void;
      deleteBlog: (blogId: number) => Promise<void>;
      toggleComments: (blogId: number) => void;
      addComment: (event: Event, blogId: number, isModal?: boolean) => Promise<void>;
      showLoginForm: () => void;
      showRegisterForm: () => void;
      openCreateBlogPopup: () => void;
    }
  }
  
  window.setupApp = setupApp;
  window.openEditPopup = openEditPopup;
  window.deleteBlog = deleteBlog;
  window.toggleComments = toggleComments;
  window.addComment = addComment;
  window.showLoginForm = showLoginForm;
  window.showRegisterForm = showRegisterForm;
  window.openCreateBlogPopup = openCreateBlogPopup;