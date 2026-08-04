import type { FC } from 'react';
import type { Todo } from '../types/Todo';
import { TodoItem } from './TodoItem';

type Props = {
  todos: Todo[];
  processingTodoIds: number[];
  tempTodo: Todo | null;
  onDelete: (todoId: number) => void;
};

export const TodoList: FC<Props> = ({
  todos,
  processingTodoIds,
  tempTodo,
  onDelete,
}) => (
  <section className="todoapp__main" data-cy="TodoList">
    {todos.map(todo => (
      <TodoItem
        key={todo.id}
        todo={todo}
        isProcessing={processingTodoIds.includes(todo.id)}
        onDelete={onDelete}
      />
    ))}

    {tempTodo && <TodoItem todo={tempTodo} isProcessing />}
  </section>
);
