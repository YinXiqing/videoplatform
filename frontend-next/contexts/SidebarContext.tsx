"use client";
import { createContext, useCallback, useContext, useState } from "react";

interface SidebarContextValue {
	open: boolean;
	setOpen: (v: boolean) => void;
	toggle: () => void;
	close: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
	open: false,
	setOpen: () => {},
	toggle: () => {},
	close: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = useState(false);
	const toggle = useCallback(() => setOpen((v) => !v), []);
	const close = useCallback(() => setOpen(false), []);
	return (
		<SidebarContext.Provider value={{ open, setOpen, toggle, close }}>
			{children}
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	return useContext(SidebarContext);
}
