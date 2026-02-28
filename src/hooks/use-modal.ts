import { create } from "zustand";

export interface ModalProps {
	[key: string]: unknown;
}

interface Modal {
	id: string;
	props?: ModalProps;
}

interface ModalStore {
	closeAllModals: () => void;
	closeModal: (id: string) => void;
	getModalProps: <T = ModalProps>(id: string) => T | undefined;
	isModalOpen: (id: string) => boolean;
	modals: Modal[];
	openModal: (id: string, props?: ModalProps) => void;
}

export const useModalStore = create<ModalStore>((set, get) => ({
	modals: [],

	openModal: (id: string, props?: ModalProps) => {
		set((state) => {
			// Prevent duplicates
			const exists = state.modals.some((modal) => modal.id === id);
			if (exists) {
				// Update props if modal already exists
				return {
					modals: state.modals.map((modal) =>
						modal.id === id ? { ...modal, props } : modal
					),
				};
			}
			return { modals: [...state.modals, { id, props }] };
		});
	},

	closeModal: (id: string) => {
		set((state) => ({
			modals: state.modals.filter((modal) => modal.id !== id),
		}));
	},

	closeAllModals: () => {
		set({ modals: [] });
	},

	isModalOpen: (id: string) => get().modals.some((modal) => modal.id === id),

	getModalProps: <T = ModalProps>(id: string): T | undefined => {
		const modalData = get().modals.find((modal) => modal.id === id);
		return modalData?.props as T | undefined;
	},
}));

// Custom hook for individual modal control
export const useModal = <T = ModalProps>(modalId: string) => {
	const { openModal, closeModal, isModalOpen, getModalProps } = useModalStore();

	return {
		isOpen: isModalOpen(modalId),
		open: (props?: T) => openModal(modalId, props as ModalProps),
		close: () => closeModal(modalId),
		props: getModalProps<T>(modalId),
	};
};
