export function createSuccessResponse<T>(data: T) {
	return {
		success: true,
		data,
	};
}

export function createErrorResponse(message: string) {
	return {
		success: false,
		message,
	};
}
