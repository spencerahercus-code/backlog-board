// DOM Elements
const modal = document.getElementById('modal');
const openFormBtn = document.getElementById('openForm');
const closeBtn = document.querySelector('.close');
const itemForm = document.getElementById('itemForm');
const toggleViewBtn = document.getElementById('toggleView');
const kanbanView = document.getElementById('kanbanView');
const tableView = document.getElementById('tableView');

// View State
let isKanbanView = true;

// Open/Close Modal
openFormBtn.addEventListener('click', () => {
  modal.classList.add('active');
});

closeBtn.addEventListener('click', () => {
  modal.classList.remove('active');
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('active');
  }
});

// Toggle View
toggleViewBtn.addEventListener('click', () => {
  isKanbanView = !isKanbanView;
  if (isKanbanView) {
    kanbanView.style.display = 'grid';
    tableView.style.display = 'none';
    toggleViewBtn.textContent = 'Switch to Table View';
  } else {
    kanbanView.style.display = 'none';
    tableView.style.display = 'block';
    toggleViewBtn.textContent = 'Switch to Kanban View';
  }
});

// Form Submission
itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = {
    project: document.getElementById('project').value,
    description: document.getElementById('description').value,
    dueDate: document.getElementById('dueDate').value,
    priority: document.getElementById('priority').value,
    requester: document.getElementById('requester').value,
    assignee: document.getElementById('assignee').value,
    category: document.getElementById('category').value,
  };

  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      modal.classList.remove('active');
      itemForm.reset();
      loadItems(); // Refresh the board
    } else {
      alert('Failed to add item. Please try again.');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to add item. Please try again.');
  }
});

// Load Items from Server
async function loadItems() {
  try {
    const response = await fetch('/api/items');
    const items = await response.json();
    renderKanban(items);
    renderTable(items);
  } catch (error) {
    console.error('Error loading items:', error);
  }
}

// Render Kanban Board
function renderKanban(items) {
  // Clear columns
  document.getElementById('notStarted').innerHTML = '';
  document.getElementById('inProgress').innerHTML = '';
  document.getElementById('inReview').innerHTML = '';
  document.getElementById('done').innerHTML = '';

  items.forEach(item => {
    const card = createKanbanCard(item);
    const columnId = getColumnId(item.progress);
    document.getElementById(columnId).appendChild(card);
  });
}

// Get column ID from progress status
function getColumnId(progress) {
  const mapping = {
    'Not Started': 'notStarted',
    'In Progress': 'inProgress',
    'In Review': 'inReview',
    'Done': 'done'
  };
  return mapping[progress] || 'notStarted';
}

// Create Kanban Card
function createKanbanCard(item) {
  const card = document.createElement('div');
  card.className = `kanban-card priority-${item.priority.toLowerCase()}`;
  card.draggable = true;
  card.dataset.id = item.id;

  card.innerHTML = `
    <h4>${escapeHtml(item.project)}</h4>
    ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
    <div class="meta">
      <span class="due-date">${item.dueDate || 'No due date'}</span>
      <span class="priority-badge ${item.priority.toLowerCase()}">${item.priority}</span>
    </div>
  `;

  // Drag Events
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);

  return card;
}

// Render Table View
function renderTable(items) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  items.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(item.project)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${item.dueDate || '-'}</td>
      <td>${item.progress}</td>
      <td><span class="priority-badge ${item.priority.toLowerCase()}">${item.priority}</span></td>
      <td>${escapeHtml(item.requester)}</td>
      <td>${escapeHtml(item.assignee)}</td>
      <td>${item.category}</td>
    `;
    tbody.appendChild(row);
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Drag and Drop Handlers
let draggedCard = null;

function handleDragStart(e) {
  draggedCard = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd() {
  this.classList.remove('dragging');
  draggedCard = null;
  document.querySelectorAll('.kanban-column').forEach(col => {
    col.classList.remove('drag-over');
  });
}

// Set up drop zones
document.querySelectorAll('.kanban-column').forEach(column => {
  column.addEventListener('dragover', (e) => {
    e.preventDefault();
    column.classList.add('drag-over');
  });

  column.addEventListener('dragleave', () => {
    column.classList.remove('drag-over');
  });

  column.addEventListener('drop', async (e) => {
    e.preventDefault();
    column.classList.remove('drag-over');

    if (draggedCard) {
      const newProgress = column.dataset.status;
      const itemId = draggedCard.dataset.id;

      // Move card visually
      column.querySelector('.kanban-items').appendChild(draggedCard);

      // Update on server
      try {
        await fetch(`/api/items/${itemId}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress: newProgress }),
        });
        loadItems(); // Refresh to sync
      } catch (error) {
        console.error('Error updating progress:', error);
        loadItems(); // Refresh to revert on error
      }
    }
  });
});

// Auto-refresh every 30 seconds to see changes from other users
setInterval(loadItems, 30000);

// Initial load
loadItems();
