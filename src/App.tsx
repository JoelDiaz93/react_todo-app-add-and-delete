import classNames from 'classnames';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChangeEvent, FC, FormEvent } from 'react';
import { createTodo, deleteTodo, getTodos, USER_ID } from './api/todos';
import { ErrorNotification } from './components/ErrorNotification';
import { FilterStatus, TodoFilter } from './components/TodoFilter';
import { TodoList } from './components/TodoList';
import type { Todo } from './types/Todo';
import { UserWarning } from './UserWarning';

const LOAD_ERROR_MESSAGE = 'Unable to load todos';
const ADD_ERROR_MESSAGE = 'Unable to add a todo';
const DELETE_ERROR_MESSAGE = 'Unable to delete a todo';
const EMPTY_TITLE_ERROR_MESSAGE = 'Title should not be empty';
const ERROR_HIDE_DELAY = 3000;

function getVisibleTodos(todos: Todo[], status: FilterStatus): Todo[] {
  switch (status) {
    case FilterStatus.Active:
      return todos.filter(todo => !todo.completed);

    case FilterStatus.Completed:
      return todos.filter(todo => todo.completed);

    default:
      return todos;
  }
}

export const App: FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedStatus, setSelectedStatus] = useState(FilterStatus.All);
  const [title, setTitle] = useState('');
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [processingTodoIds, setProcessingTodoIds] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVersion, setErrorVersion] = useState(0);
  const newTodoFieldRef = useRef<HTMLInputElement>(null);

  const hideError = useCallback(() => {
    setErrorMessage('');
  }, []);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorVersion(currentVersion => currentVersion + 1);
  }, []);

  const focusNewTodoField = useCallback(() => {
    newTodoFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!USER_ID) {
      return undefined;
    }

    let isMounted = true;

    hideError();

    getTodos()
      .then(loadedTodos => {
        if (isMounted) {
          setTodos(loadedTodos);
        }
      })
      .catch(() => {
        if (isMounted) {
          showError(LOAD_ERROR_MESSAGE);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hideError, showError]);

  useEffect(() => {
    if (!errorMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorMessage('');
    }, ERROR_HIDE_DELAY);

    return () => window.clearTimeout(timeoutId);
  }, [errorMessage, errorVersion]);

  useEffect(() => {
    if (!isAdding) {
      focusNewTodoField();
    }
  }, [focusNewTodoField, isAdding]);

  const visibleTodos = useMemo(
    () => getVisibleTodos(todos, selectedStatus),
    [todos, selectedStatus],
  );

  const activeTodosCount = todos.filter(todo => !todo.completed).length;
  const completedTodos = todos.filter(todo => todo.completed);
  const allTodosCompleted = todos.length > 0 && activeTodosCount === 0;
  const counterLabel = activeTodosCount === 1 ? 'item' : 'items';

  const addProcessingTodo = (todoId: number) => {
    setProcessingTodoIds(currentIds => {
      if (currentIds.includes(todoId)) {
        return currentIds;
      }

      return [...currentIds, todoId];
    });
  };

  const removeProcessingTodo = (todoId: number) => {
    setProcessingTodoIds(currentIds =>
      currentIds.filter(currentId => currentId !== todoId),
    );
  };

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };

  const handleNewTodoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    hideError();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      showError(EMPTY_TITLE_ERROR_MESSAGE);
      focusNewTodoField();

      return;
    }

    const newTodo: Omit<Todo, 'id'> = {
      userId: USER_ID,
      title: trimmedTitle,
      completed: false,
    };

    setTempTodo({ id: 0, ...newTodo });
    setIsAdding(true);

    try {
      const createdTodo = await createTodo(newTodo);

      setTodos(currentTodos => [...currentTodos, createdTodo]);
      setTitle('');
    } catch {
      showError(ADD_ERROR_MESSAGE);
    } finally {
      setTempTodo(null);
      setIsAdding(false);
    }
  };

  const handleDeleteTodo = async (todoId: number) => {
    hideError();
    addProcessingTodo(todoId);

    try {
      await deleteTodo(todoId);
      setTodos(currentTodos =>
        currentTodos.filter(todo => todo.id !== todoId),
      );
    } catch {
      showError(DELETE_ERROR_MESSAGE);
    } finally {
      removeProcessingTodo(todoId);
      focusNewTodoField();
    }
  };

  const handleClearCompleted = async () => {
    hideError();

    const completedTodoIds = completedTodos.map(todo => todo.id);

    setProcessingTodoIds(currentIds => [
      ...new Set([...currentIds, ...completedTodoIds]),
    ]);

    const results = await Promise.allSettled(
      completedTodoIds.map(todoId => deleteTodo(todoId)),
    );
    const successfullyDeletedIds = completedTodoIds.filter(
      (_, index) => results[index].status === 'fulfilled',
    );
    const hasDeletionError = results.some(
      result => result.status === 'rejected',
    );

    setTodos(currentTodos =>
      currentTodos.filter(todo => !successfullyDeletedIds.includes(todo.id)),
    );
    setProcessingTodoIds(currentIds =>
      currentIds.filter(todoId => !completedTodoIds.includes(todoId)),
    );

    if (hasDeletionError) {
      showError(DELETE_ERROR_MESSAGE);
    }

    focusNewTodoField();
  };

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {todos.length > 0 && (
            <button
              type="button"
              className={classNames('todoapp__toggle-all', {
                active: allTodosCompleted,
              })}
              data-cy="ToggleAllButton"
              aria-label="Toggle all todos"
            />
          )}

          <form onSubmit={handleNewTodoSubmit}>
            <input
              ref={newTodoFieldRef}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={title}
              disabled={isAdding}
              autoFocus
              onChange={handleTitleChange}
            />
          </form>
        </header>

        {(visibleTodos.length > 0 || tempTodo) && (
          <TodoList
            todos={visibleTodos}
            processingTodoIds={processingTodoIds}
            tempTodo={tempTodo}
            onDelete={handleDeleteTodo}
          />
        )}

        {todos.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {`${activeTodosCount} ${counterLabel} left`}
            </span>

            <TodoFilter
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
            />

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={completedTodos.length === 0}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <ErrorNotification message={errorMessage} onClose={hideError} />
    </div>
  );
};
