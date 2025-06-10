// Borrowed from https://github.com/jsun969/react-hook-form-antd/blob/main/src/FormItem.tsx
// Once the package supports React 19, we can remove this file.

import { Form as AntdForm } from 'antd';
import { Children, cloneElement, isValidElement, useEffect } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useController } from 'react-hook-form';

type AntdFormItemProps = React.ComponentProps<typeof AntdForm.Item>;

export type FormItemProps<TFieldValues extends FieldValues = FieldValues> = {
	children: React.ReactNode;
	control: Control<TFieldValues>;
	name: FieldPath<TFieldValues>;
	disabled?: boolean;
	overrideFieldOnChange?: (...values: any[]) => void;
} & Omit<AntdFormItemProps, 'name' | 'rules' | 'validateStatus'>;

// TODO: Support `onBlur` `ref` `reset`
export const FormItem = <TFieldValues extends FieldValues = FieldValues>({
	children,
	control,
	name,
	disabled,
	help,
	valuePropName,
	overrideFieldOnChange,
	...props
}: FormItemProps<TFieldValues>) => {
	const { field, fieldState } = useController({ name, control, disabled });
	const form = AntdForm.useFormInstance();

	useEffect(() => {
		form.setFieldValue(name, field.value);
	}, [field.value, form, name]);

	return (
		<AntdForm.Item
			{...props}
			//@ts-expect-error Ant Design form item name type safe is not necessary here
			name={name}
			initialValue={field.value}
			validateStatus={fieldState.invalid ? 'error' : undefined}
			help={fieldState.error?.message ?? help}
		>
			{Children.map(
				children,
				(child) => {
                    const childAny: any = child
					return isValidElement(child) &&
					cloneElement(childAny, {
						...field,
						onChange: (...params) => {
							childAny.props.onChange && childAny.props.onChange(...params);
							overrideFieldOnChange
								? overrideFieldOnChange(...params)
								: field.onChange(...params);
						},
						onBlur: () => {
							childAny.props.onBlur && childAny.props.onBlur();
							field.onBlur();
						},
						...(valuePropName && {
							[valuePropName]: field.value,
						}),
					})
			})}
		</AntdForm.Item>
	);
};