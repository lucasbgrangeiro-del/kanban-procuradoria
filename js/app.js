// Application Logic & DOM Operations
document.addEventListener('DOMContentLoaded', () => {
    // 1. App State
    let globalTasks = []; // Real-time cached tasks from Firebase
    let currentDistType = 'Judicial'; // Tracks which Distribuição tab we are on

    // 2. DOM Elements Selection
    const modal = document.getElementById('taskModal');
    const closeBtn = document.getElementById('closeModal');
    const btnCancel = document.getElementById('btnCancel');
    const form = document.getElementById('taskForm');

    const detailsModal = document.getElementById('detailsModal');
    const closeDetailsModal = document.getElementById('closeDetailsModal');

    // Navigation Modules
    const navLinks = document.querySelectorAll('.nav-link');
    const modules = document.querySelectorAll('.module');

    // Views
    const btnViewKanban = document.getElementById('btnViewKanban');
    const btnViewTable = document.getElementById('btnViewTable');
    const kanbanView = document.getElementById('kanban-view');
    const tableView = document.getElementById('table-view');

    // Filters Mesa do Procurador
    const mesaProcuradorFilter = document.getElementById('mesaProcuradorFilter');
    const mesaAssessorFilter = document.getElementById('mesaAssessorFilter');

    // Open Distribution Form
    const btnOpenDistribuicao = document.getElementById('btnOpenDistribuicao');

    // EXPORT PDF
    const btnExportPDF = document.getElementById('btnExportPDF');

    // 3. Routing & Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            navLinks.forEach(l => l.classList.remove('active'));
            modules.forEach(m => {
                m.classList.remove('active');
                m.style.display = 'none';
            });

            link.classList.add('active');
            const targetId = link.getAttribute('data-target');
            const targetType = link.getAttribute('data-type');

            if (targetType) {
                currentDistType = targetType;
                const distTitle = document.getElementById('distribuicao-title');
                if (distTitle) distTitle.textContent = `Distribuição ${targetType}`;
            }

            const targetModule = document.getElementById(targetId);
            if (targetModule) {
                targetModule.classList.add('active');
                targetModule.style.display = targetModule.id === 'module-procurador' || targetModule.id === 'module-distribuicao' || targetModule.id === 'module-dashboard' || targetModule.id === 'module-relatorios' ? 'flex' : 'block';
            }

            renderAllViews();
        });
    });

    // Toggle Kanban/Table Views
    if (btnViewKanban && btnViewTable) {
        btnViewKanban.addEventListener('click', () => {
            btnViewKanban.classList.add('active');
            btnViewTable.classList.remove('active');
            kanbanView.style.display = 'flex';
            tableView.style.display = 'none';
        });

        btnViewTable.addEventListener('click', () => {
            btnViewTable.classList.add('active');
            btnViewKanban.classList.remove('active');
            tableView.style.display = 'block';
            kanbanView.style.display = 'none';
        });
    }

    // Modal Operations
    btnOpenDistribuicao.addEventListener('click', () => openModal());
    closeBtn.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Details Modal Operations
    if (closeDetailsModal) {
        closeDetailsModal.addEventListener('click', () => {
            detailsModal.classList.remove('show');
        });
    }
    detailsModal.addEventListener('click', (e) => { if (e.target === detailsModal) detailsModal.classList.remove('show'); });

    // Mesa Filters Trigger
    if (mesaProcuradorFilter) mesaProcuradorFilter.addEventListener('change', () => renderProcuradorMesa(globalTasks));
    if (mesaAssessorFilter) mesaAssessorFilter.addEventListener('change', () => renderProcuradorMesa(globalTasks));


    // 4. Realtime Data
    function initRealtimeUpdates() {
        if (!window.db) return;
        const q = window.collection(window.db, "tasks");

        window.onSnapshot(q, (querySnapshot) => {
            globalTasks = [];
            querySnapshot.forEach((doc) => {
                globalTasks.push(doc.data());
            });

            // Sort by distribution date descending as standard
            globalTasks.sort((a, b) => new Date(b.distributionDate || a.dueDate) - new Date(a.distributionDate || b.dueDate));

            renderAllViews();
        });
    }

    function renderAllViews() {
        renderProcuradorMesa(globalTasks);
        renderDistribuicaoMesa(globalTasks);
        renderDashboard(globalTasks);
        renderRelatorios(globalTasks);
    }

    function formatDateForDisplay(isoString) {
        if (!isoString) return '';
        const dateParts = isoString.split('-');
        if (dateParts.length !== 3) return isoString;
        return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    }

    function isOverdue(dateString) {
        if (!dateString) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const parts = dateString.split('-');
        if (parts.length < 3) return false;
        const dueDate = new Date(parts[0], parts[1] - 1, parts[2]);
        dueDate.setHours(0, 0, 0, 0);

        return dueDate < today;
    }

    function getDisplayStatus(status) {
        const map = {
            'triage': 'Triagem',
            'advisory': 'Assessoria',
            'execution': 'Execução',
            'correction': 'Correção',
            'finished': 'Finalizado'
        };
        return map[status] || status;
    }

    // --- MODULE: MESA DE PROCURADOR ---
    function renderProcuradorMesa(tasks) {
        const procFilterVal = mesaProcuradorFilter ? mesaProcuradorFilter.value : 'Lucas Grangeiro';
        const assessorFilterVal = mesaAssessorFilter ? mesaAssessorFilter.value : 'all';

        const myTasks = tasks.filter(task => {
            // Apply Procurador filter
            if (procFilterVal !== 'all') {
                const assigned = task.assignedProcurador || 'Lucas Grangeiro'; // legacy fallback
                if (assigned !== procFilterVal) return false;
            }
            // Apply Assessor filter
            if (assessorFilterVal !== 'all') {
                if (task.responsible !== assessorFilterVal) return false;
            }
            return true;
        });

        // Render Kanban
        const columns = ['triage', 'advisory', 'execution', 'correction', 'finished'];
        const counts = { triage: 0, advisory: 0, execution: 0, correction: 0, finished: 0 };

        columns.forEach(col => {
            const container = document.getElementById(`col-${col}`);
            if (container) container.innerHTML = '';
        });

        const tableBody = document.getElementById('procurador-table-body');
        if (tableBody) tableBody.innerHTML = '';

        myTasks.forEach(task => {
            const colEl = document.getElementById(`col-${task.status}`);
            if (colEl) {
                colEl.appendChild(createTaskCardElement(task));
                counts[task.status]++;
            }

            // Also append to full table view 
            if (tableBody && task.status !== 'finished') {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDateForDisplay(task.distributionDate) || '--/--/----'}</td>
                    <td><b>${task.attusNumber}</b> <br> <span style="font-size:0.8rem; color:#6b7280;">SEI: ${task.seiNumber || '-'}</span></td>
                    <td>${task.interestedParty || 'Não informado'}</td>
                    <td>${task.responsible && task.responsible !== 'Unassigned' ? task.responsible : 'Nenhum'}</td>
                    <td class="${isOverdue(task.dueDate) ? 'font-bold' : ''}" style="${isOverdue(task.dueDate) ? 'color: red;' : ''}">${formatDateForDisplay(task.dueDate)}</td>
                    <td><span style="background:#e5e7eb; color:#374151; padding:4px 8px; border-radius:4px; font-size:0.8rem;">${getDisplayStatus(task.status)}</span></td>
                `;
                tableBody.appendChild(tr);
            }
        });

        // Update counts in column headers
        columns.forEach(col => {
            const header = document.querySelector(`.column-header.${col} .task-count`);
            if (header) {
                header.textContent = counts[col];
            }
        });
    }

    // --- MODULE: DISTRIBUICAO ---
    const filterDistProcurador = document.getElementById('filterDistProcurador');
    const filterDistMonth = document.getElementById('filterDistMonth');
    if (filterDistProcurador) filterDistProcurador.addEventListener('change', () => renderDistribuicaoMesa(globalTasks));
    if (filterDistMonth) filterDistMonth.addEventListener('change', () => renderDistribuicaoMesa(globalTasks));

    function renderDistribuicaoMesa(tasks) {
        // 1. Dashboard Pending Breakdown
        const distMetricsGrid = document.getElementById('dist-pending-metrics');
        if (distMetricsGrid) {
            const procuradores = ['Lucas Grangeiro', 'Caterine', 'Luís Cabral'];
            let distHtml = '';
            procuradores.forEach(proc => {
                const pendentes = tasks.filter(t => (t.assignedProcurador || 'Lucas Grangeiro') === proc && t.status !== 'finished' && t.type === currentDistType).length;
                distHtml += `
                    <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:1rem; text-align:center;">
                        <h4 style="color:#6b7280; font-size:0.9rem; font-weight:600;">${proc}</h4>
                        <span style="display:block; font-size:1.8rem; font-weight:700; color:#3b82f6; margin-top:0.5rem;">${pendentes}</span>
                        <span style="font-size:0.8rem; color:#4b5563;">Pendentes (${currentDistType})</span>
                    </div>
                `;
            });
            distMetricsGrid.innerHTML = distHtml;
        }


        // 2. Recent Distributed Table
        const tbody = document.getElementById('recent-dist-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        let filtered = tasks.filter(t => t.type === currentDistType); // Filter by the current route type

        if (filterDistProcurador && filterDistProcurador.value !== 'all') {
            filtered = filtered.filter(t => (t.assignedProcurador || 'Lucas Grangeiro') === filterDistProcurador.value);
        }

        if (filterDistMonth && filterDistMonth.value) {
            // value is YYYY-MM
            filtered = filtered.filter(t => {
                if (!t.distributionDate) return false;
                return t.distributionDate.startsWith(filterDistMonth.value);
            });
        }

        const recentTasks = filtered.slice(0, 50); // Show more since we have a month filter

        recentTasks.forEach(task => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDateForDisplay(task.distributionDate) || '--/--/----'}</td>
                <td><b>${task.attusNumber}</b></td>
                <td>${task.interestedParty || '-'}</td>
                <td>${task.assignedProcurador || 'Lucas Grangeiro'}</td>
                <td><span style="background:#f3f4f6; color:#4b5563; padding:4px 8px; border-radius:4px;">${task.type}</span></td>
                <td>
                    <button style="background:none; border:none; cursor:pointer; color:#3b82f6;" onclick="window.editTask('${task.id}')" title="Editar">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- MODULE: DASHBOARD ---
    function renderDashboard(tasks) {
        const grid = document.getElementById('dashboard-metrics');
        if (!grid) return;

        const procuradores = ['Lucas Grangeiro', 'Caterine', 'Luís Cabral'];
        let metricsHtml = '';

        procuradores.forEach(proc => {
            const procTasks = tasks.filter(t => (t.assignedProcurador || 'Lucas Grangeiro') === proc && t.status !== 'finished');

            const overdue = procTasks.filter(t => isOverdue(t.dueDate)).length;

            // This week calculation
            const today = new Date();
            const weekFromNow = new Date();
            weekFromNow.setDate(today.getDate() + 7);
            const dueThisWeek = procTasks.filter(t => {
                if (!t.dueDate) return false;
                const dateParts = t.dueDate.split('-');
                if (dateParts.length < 3) return false;
                const taskDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                return taskDate >= today && taskDate <= weekFromNow;
            }).length;

            metricsHtml += `
                <div style="background:white; border-radius:8px; padding:1.5rem; border:1px solid #e5e7eb; display:flex; flex-direction:column; gap:0.5rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:600; color:#374151; font-size:1.1rem;">${proc}</span>
                        <div style="width:30px; height:30px; border-radius:50%; background:#eff6ff; color:#3b82f6; display:flex; justify-content:center; align-items:center; font-weight:bold;">${getInitials(proc)}</div>
                    </div>
                    <div style="margin-top:0.5rem; display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
                        <div style="background:#f8fafc; padding:0.75rem; border-radius:6px; text-align:center; cursor:pointer;" onclick="window.showDetails('${proc}', 'active')" title="Ver Processos em Andamento">
                            <span style="display:block; font-size:1.5rem; font-weight:700; color:#3b82f6; transition:color 0.2s;" onmouseover="this.style.color='#1d4ed8'" onmouseout="this.style.color='#3b82f6'">${procTasks.length}</span>
                            <span style="font-size:0.75rem; color:#6b7280; text-transform:uppercase;">Em Andamento</span>
                        </div>
                        <div style="background:#fee2e2; padding:0.75rem; border-radius:6px; text-align:center; cursor:pointer;" onclick="window.showDetails('${proc}', 'overdue')" title="Ver Processos Atrasados">
                            <span style="display:block; font-size:1.5rem; font-weight:700; color:#ef4444; transition:color 0.2s;" onmouseover="this.style.color='#b91c1c'" onmouseout="this.style.color='#ef4444'">${overdue}</span>
                            <span style="font-size:0.75rem; color:#ef4444; text-transform:uppercase;">Atrasados</span>
                        </div>
                        <div style="grid-column: span 2; background:#fef3c7; padding:0.75rem; border-radius:6px; text-align:center; cursor:pointer;" onclick="window.showDetails('${proc}', 'week')" title="Ver Processos Vencendo na Semana">
                            <span style="display:block; font-size:1.1rem; font-weight:700; color:#d97706; transition:color 0.2s;" onmouseover="this.style.color='#b45309'" onmouseout="this.style.color='#d97706'">${dueThisWeek}</span>
                            <span style="font-size:0.75rem; color:#d97706; text-transform:uppercase;">Vencendo na Semana</span>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = metricsHtml;
    }

    // Modal Details Logic for Dashboard 
    window.showDetails = function (procurador, metricType) {
        const titleEl = document.getElementById('detailsModalTitle');
        const tbody = document.getElementById('details-table-body');

        let headerText = '';
        let filtered = globalTasks.filter(t => (t.assignedProcurador || 'Lucas Grangeiro') === procurador && t.status !== 'finished');

        if (metricType === 'active') {
            headerText = `Processos em Andamento - ${procurador}`;
            // filtered is already correct
        } else if (metricType === 'overdue') {
            headerText = `Processos Atrasados - ${procurador}`;
            filtered = filtered.filter(t => isOverdue(t.dueDate));
        } else if (metricType === 'week') {
            headerText = `Vencendo na Semana - ${procurador}`;
            const today = new Date();
            const weekFromNow = new Date();
            weekFromNow.setDate(today.getDate() + 7);
            filtered = filtered.filter(t => {
                if (!t.dueDate) return false;
                const d = t.dueDate.split('-');
                if (d.length < 3) return false;
                const taskDate = new Date(d[0], d[1] - 1, d[2]);
                return taskDate >= today && taskDate <= weekFromNow;
            });
        }

        titleEl.textContent = headerText;
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum processo encontrado.</td></tr>';
        } else {
            filtered.forEach(task => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDateForDisplay(task.distributionDate) || '--/--/----'}</td>
                    <td><b>${task.attusNumber}</b><br><span style="font-size:0.8rem;color:#6b7280">SEI: ${task.seiNumber || '-'}</span></td>
                    <td>${task.interestedParty || '-'}</td>
                    <td>${task.responsible && task.responsible !== 'Unassigned' ? task.responsible : 'Sem atribuição'}</td>
                    <td style="${isOverdue(task.dueDate) ? 'color:red;' : ''}">${getDisplayStatus(task.status)} <br> <span style="font-weight:bold; font-size:0.8rem;">${formatDateForDisplay(task.dueDate)}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }

        detailsModal.classList.add('show');
    };

    // --- MODULE: RELATORIOS ---
    const reportFilter = document.getElementById('reportProcuradorFilter');
    const reportStatusFilter = document.getElementById('reportStatusFilter');
    const reportMonthFilter = document.getElementById('reportMonthFilter');

    if (reportFilter) reportFilter.addEventListener('change', () => renderRelatorios(globalTasks));
    if (reportStatusFilter) reportStatusFilter.addEventListener('change', () => renderRelatorios(globalTasks));
    if (reportMonthFilter) reportMonthFilter.addEventListener('change', () => renderRelatorios(globalTasks));

    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', () => {
            const element = document.getElementById('reports-table');
            const proc = reportFilter ? reportFilter.value : 'all';
            const opt = {
                margin: 10,
                filename: `Relatorio_Procuradoria_${proc}_${Date.now()}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };

            // Call html2pdf
            // We temporarily wrap it so it looks good when printing
            const clone = element.cloneNode(true);
            const container = document.createElement('div');
            container.innerHTML = `<h2 style="font-family:sans-serif; margin-bottom: 20px;">Relatório de Processos - Procuradoria Legal</h2>`;
            container.appendChild(clone);

            html2pdf().set(opt).from(container).save();
        });
    }

    function renderRelatorios(tasks) {
        const tbody = document.getElementById('reports-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        let filtered = tasks;

        // Filter by Procurador
        if (reportFilter && reportFilter.value !== 'all') {
            filtered = filtered.filter(t => (t.assignedProcurador || 'Lucas Grangeiro') === reportFilter.value);
        }

        // Filter by Status (Ativos / Finalizados)
        if (reportStatusFilter && reportStatusFilter.value !== 'all') {
            if (reportStatusFilter.value === 'active') {
                filtered = filtered.filter(t => t.status !== 'finished');
            } else if (reportStatusFilter.value === 'finished') {
                filtered = filtered.filter(t => t.status === 'finished');
            }
        }

        // Filter by Month Reference (Comparing Date of Distribution or Due Date as a fallback)
        if (reportMonthFilter && reportMonthFilter.value) {
            filtered = filtered.filter(t => {
                const refDate = t.distributionDate || t.dueDate;
                if (!refDate) return false;
                return refDate.startsWith(reportMonthFilter.value); // Because iso is YYYY-MM
            });
        }

        filtered.forEach(task => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDateForDisplay(task.distributionDate) || '--/--/----'}</td>
                <td><b>${task.attusNumber}</b> <br> <span style="font-size:0.8rem; color:#6b7280;">Interessado: ${task.interestedParty || '-'}</span></td>
                <td>${task.assignedProcurador || 'Lucas Grangeiro'}</td>
                <td>${getDisplayStatus(task.status)}</td>
                <td style="${isOverdue(task.dueDate) ? 'color:red; font-weight:bold;' : ''}">${formatDateForDisplay(task.dueDate)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- SHARED UTILS --- 
    function getInitials(name) {
        if (!name || name === 'Unassigned') return '?';
        const parts = name.split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    function createTaskCardElement(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.id = task.id;
        card.dataset.type = task.type || 'Judicial';

        let badgesHtml = '';
        const overdueClass = isOverdue(task.dueDate) ? 'overdue' : '';

        const judicialHtml = task.judicialNumber ? `<p><i class="fa-solid fa-scale-unbalanced"></i> ${task.judicialNumber}</p>` : '';

        // Safely provide fallbacks for old data
        const typeDisplay = task.type || 'Judicial';
        const interestedPartyDisplay = task.interestedParty ? `<p style="font-weight: 500; color: #374151; margin-bottom: 0.4rem;">${task.interestedParty}</p>` : '';

        card.innerHTML = `
            <div class="card-header">
                <div class="badges">
                    <span class="badge" style="background-color: #f3f4f6; color: #4b5563;">${typeDisplay}</span>
                    ${badgesHtml}
                </div>
                <button class="btn-edit" onclick="window.editTask('${task.id}')">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
            </div>
            
            <div class="card-title">${task.attusNumber}</div>
            
            <div class="card-details">
                ${interestedPartyDisplay}
                <p><i class="fa-solid fa-folder-open"></i> SEI: ${task.seiNumber || '-'}</p>
                ${judicialHtml}
            </div>
            
            <div class="card-footer">
                <div class="assignee">
                    <div class="avatar" title="${task.responsible}">${getInitials(task.responsible)}</div>
                    <span>${task.responsible && task.responsible !== 'Unassigned' ? task.responsible.split(' ')[0] : 'Gabinete'}</span>
                </div>
                <div class="due-date ${overdueClass}" title="Vencimento">
                    <i class="fa-regular fa-calendar"></i> ${formatDateForDisplay(task.dueDate)}
                </div>
            </div>
        `;
        return card;
    }

    function initDragAndDrop() {
        const columns = document.querySelectorAll('.column-body');
        columns.forEach(col => {
            new Sortable(col, {
                group: 'kanban',
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                onEnd: async function (evt) {
                    const itemEl = evt.item;
                    const toEl = evt.to;
                    const taskId = itemEl.dataset.id;
                    const newStatusContainer = toEl.closest('.kanban-column');
                    if (newStatusContainer) {
                        const newStatus = newStatusContainer.dataset.status;
                        await DataStore.updateTaskStatus(taskId, newStatus);
                    }
                },
            });
        });
    }

    // Modal Form Logic
    async function openModal(taskId = null) {
        form.reset();
        document.getElementById('taskId').value = '';
        document.getElementById('modalTitle').textContent = 'Distribuir Novo Processo';

        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('distributionDate').value = todayStr;

        // Auto select type based on route
        document.getElementById('taskType').value = currentDistType || 'Judicial';

        if (taskId) {
            const task = await DataStore.getTaskById(taskId);
            if (task) {
                document.getElementById('modalTitle').textContent = 'Editar Processo';
                document.getElementById('taskId').value = task.id;

                document.getElementById('distributionDate').value = task.distributionDate || todayStr;
                document.getElementById('dueDate').value = task.dueDate;
                document.getElementById('assignedProcurador').value = task.assignedProcurador || 'Lucas Grangeiro';
                document.getElementById('taskType').value = task.type || 'Judicial';

                document.getElementById('attusNumber').value = task.attusNumber;
                document.getElementById('seiNumber').value = task.seiNumber || '';
                document.getElementById('interestedParty').value = task.interestedParty || '';
                document.getElementById('judicialNumber').value = task.judicialNumber || '';

                document.getElementById('responsible').value = task.responsible || 'Unassigned';
                document.getElementById('taskStatus').value = task.status || 'triage';
            }
        } else {
            document.getElementById('taskStatus').value = 'triage';
            document.getElementById('responsible').value = 'Unassigned';
        }

        modal.classList.add('show');
    }

    function closeModal() {
        modal.classList.remove('show');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSave = document.getElementById('btnSave');
        const originalText = btnSave.textContent;
        btnSave.textContent = 'Salvando...';
        btnSave.disabled = true;

        const id = document.getElementById('taskId').value;
        const taskData = {
            id: id || 'task-' + Date.now(),
            distributionDate: document.getElementById('distributionDate').value,
            dueDate: document.getElementById('dueDate').value,
            assignedProcurador: document.getElementById('assignedProcurador').value,
            type: document.getElementById('taskType').value,

            attusNumber: document.getElementById('attusNumber').value.trim(),
            seiNumber: document.getElementById('seiNumber').value.trim(),
            interestedParty: document.getElementById('interestedParty').value.trim(),
            judicialNumber: document.getElementById('judicialNumber').value.trim(),

            responsible: document.getElementById('responsible').value,
            status: document.getElementById('taskStatus').value
        };

        if (id) {
            await DataStore.updateTask(taskData);
        } else {
            await DataStore.addTask(taskData);
        }

        btnSave.textContent = originalText;
        btnSave.disabled = false;
        closeModal();
    });

    window.editTask = openModal;

    setTimeout(() => {
        if (window.db) {
            initRealtimeUpdates();
        } else {
            console.error("Firebase not initialized yet. Verify the API keys.");
        }
    }, 500);

    initDragAndDrop();
});
