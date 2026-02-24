// DataStore via Firebase Firestore
class DataStore {
    // Note: getTasks is now handled by real-time listener in app.js via onSnapshot.
    // We don't return arrays synchronously anymore.

    static async addTask(taskData) {
        try {
            // Task has our own ID (e.g. 'task-1234')
            // Using setDoc to use that custom ID as the document ID in Firebase
            const docRef = window.doc(window.db, "tasks", taskData.id);
            await window.setDoc(docRef, taskData);
            console.log("Document written with ID: ", taskData.id);
        } catch (e) {
            console.error("Error adding document: ", e);
            alert("Erro ao salvar no banco de dados. Verifique a conexão.");
        }
    }

    static async updateTask(updatedTask) {
        try {
            const taskRef = window.doc(window.db, "tasks", updatedTask.id);
            await window.updateDoc(taskRef, updatedTask);
            console.log("Document updated: ", updatedTask.id);
        } catch (e) {
            console.error("Error updating document: ", e);
            alert("Erro ao atualizar o processo.");
        }
    }

    static async getTaskById(id) {
        const docRef = window.doc(window.db, "tasks", id);
        const docSnap = await window.getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log("No such document!");
            return null;
        }
    }

    static async updateTaskStatus(id, newStatus) {
        try {
            const taskRef = window.doc(window.db, "tasks", id);
            await window.updateDoc(taskRef, {
                status: newStatus
            });
        } catch (e) {
            console.error("Error updating status: ", e);
        }
    }
}
