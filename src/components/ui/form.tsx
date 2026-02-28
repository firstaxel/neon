import { Slot } from "@radix-ui/react-slot";
import { createFormHookContexts, useStore } from "@tanstack/react-form";
import React from "react";

// biome-ignore lint/performance/noNamespaceImport: <need for packaging>
import * as scn from "#/components/ui/field";

const { useFieldContext, useFormContext, fieldContext, formContext } =
	createFormHookContexts();

function Form(props: React.ComponentProps<"form">) {
	const form = useFormContext();

	return (
		<form
			onSubmit={(e) => {
				e.stopPropagation();
				e.preventDefault();
				form.handleSubmit();
			}}
			{...props}
		/>
	);
}

const IdContext = React.createContext<string>(null as never);

function useFieldComponentContext() {
	const field = useFieldContext();
	const idContext = React.useContext(IdContext);

	if (typeof idContext !== "string") {
		throw new Error("Form components should be used within <Field>");
	}

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isTouched = useStore(field.store, (state) => state.meta.isTouched);
	const submissionAttempts = useStore(
		field.form.store,
		(state) => state.submissionAttempts
	);

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <need for the component>
	const fieldComponent = React.useMemo(() => {
		const showError = isTouched || submissionAttempts > 0;

		let errorMessage: string | null = null;
		if (showError && errors.length > 0) {
			const error = errors[0];

			if (typeof error === "string") {
				errorMessage = error;
			} else if (typeof error === "object" && error !== null) {
				if ("message" in error && typeof error.message === "string") {
					errorMessage = error.message;
				}
			} else if (error !== null && error !== undefined) {
				errorMessage = String(error);
			}
		}

		return {
			formControlId: `${idContext}-form-item`,
			formDescriptionId: `${idContext}-form-item-description`,
			formMessageId: `${idContext}-form-item-message`,
			error: errorMessage,
			hasError: showError && errorMessage !== null,
		};
	}, [idContext, isTouched, submissionAttempts, errors]);

	return fieldComponent;
}

function Field({
	className,
	...props
}: React.ComponentProps<typeof scn.Field>) {
	const id = React.useId();
	const field = useFieldContext();
	const errors = useStore(field.store, (state) => state.meta.errors);
	const isTouched = useStore(field.store, (state) => state.meta.isTouched);
	const submissionAttempts = useStore(
		field.form.store,
		(state) => state.submissionAttempts
	);
	const showError = isTouched || submissionAttempts > 0;
	const hasError = showError && errors.length > 0;

	return (
		<IdContext.Provider value={id}>
			<scn.Field
				className={className}
				data-invalid={hasError ? "true" : undefined}
				data-slot="form-item"
				{...props}
			/>
		</IdContext.Provider>
	);
}

function FieldLabel({
	className,
	...props
}: React.ComponentProps<typeof scn.FieldLabel>) {
	const { formControlId, hasError } = useFieldComponentContext();

	return (
		<scn.FieldLabel
			className={className}
			data-error={hasError ? "true" : undefined}
			data-slot="form-label"
			htmlFor={formControlId}
			{...props}
		/>
	);
}

function FieldControl(props: React.ComponentProps<typeof Slot>) {
	const { formControlId, formDescriptionId, formMessageId, hasError } =
		useFieldComponentContext();

	const describedBy = [formDescriptionId, hasError ? formMessageId : null]
		.filter(Boolean)
		.join(" ");

	return (
		<Slot
			aria-describedby={describedBy || undefined}
			aria-invalid={hasError}
			data-slot="form-control"
			id={formControlId}
			{...props}
		/>
	);
}

function FieldDescription({
	className,
	...props
}: React.ComponentProps<typeof scn.FieldDescription>) {
	const { formDescriptionId } = useFieldComponentContext();

	return (
		<scn.FieldDescription
			className={className}
			data-slot="form-description"
			id={formDescriptionId}
			{...props}
		/>
	);
}

function FieldError({
	className,
	...props
}: React.ComponentProps<typeof scn.FieldError>) {
	const { error, formMessageId } = useFieldComponentContext();
	const body = error ?? props.children;

	if (!body) {
		return null;
	}

	return (
		<scn.FieldError
			className={className}
			data-slot="form-message"
			id={formMessageId}
			{...props}
		>
			{body}
		</scn.FieldError>
	);
}

export {
	Form,
	Field,
	FieldLabel,
	FieldControl,
	FieldDescription,
	FieldError,
	fieldContext,
	useFieldContext,
	formContext,
	useFormContext,
};
