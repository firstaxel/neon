import { createFormHook } from "@tanstack/react-form";
import {
	Field,
	FieldControl,
	FieldDescription,
	FieldError,
	FieldLabel,
	fieldContext,
	formContext,
} from "#/components/ui/form";

export const { useAppForm, withForm } = createFormHook({
	fieldComponents: {
		Control: FieldControl,
		Description: FieldDescription,
		Error: FieldError,
		Field,
		Label: FieldLabel,
	},
	fieldContext,
	formComponents: {},
	formContext,
});
