import { useProjectStore } from '@/stores/project';
import { chooseExistingDll, chooseIconSources, ipcErrorMessage } from '@/services/tauriProject';

export function useFileUpload() {
    const project = useProjectStore();

    function handleEditSourceFiles(files: File[]): void {
        const [file] = files;
        if (file)
            project.setEditSourceFile(file);
    }

    function handleIconFiles(files: File[]): void {
        project.addFiles(files);
    }

    async function handleChooseEditSource(): Promise<void> {
        try {
            const path = await chooseExistingDll();
            if (path)
                await project.loadExistingDllPath(path);
        } catch (error) {
            project.setLastError(ipcErrorMessage(error));
        }
    }

    async function handleChooseIconSources(): Promise<void> {
        try {
            const paths = await chooseIconSources();
            await project.addIconSources(paths);
        } catch (error) {
            project.setLastError(ipcErrorMessage(error));
        }
    }

    return { handleEditSourceFiles, handleIconFiles, handleChooseEditSource, handleChooseIconSources };
}
