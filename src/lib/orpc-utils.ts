export function createSuccessResponse<T>(data: T) {
	return {
		data,
		success: true,
	};
}

export function createErrorResponse(message: string) {
	return {
		message,
		success: false,
	};
}
