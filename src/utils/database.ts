import { supabase } from '../lib/supabase';
import { Project, Content } from '../types/database';
import { Message, Chat } from '../types';

export const createProject = async (name: string, description?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        name,
        description,
        user_id: user.id
      }
    ])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating project:', error);
    throw error;
  }
  
  return data;
};

export const getProjects = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*, content(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }

  return data || [];
};

export const addContent = async (projectId: string, content: Omit<Content, 'id' | 'project_id' | 'created_at' | 'user_id'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('content')
    .insert([{
      ...content,
      project_id: projectId,
      user_id: user.id
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding content:', error);
    throw error;
  }

  return data;
};

export const getProjectContent = async (projectId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching project content:', error);
    throw error;
  }

  return data;
};

export const deleteProject = async (projectId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
};

export const updateProject = async (projectId: string, updates: Partial<Project>) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating project:', error);
    throw error;
  }

  return data;
};

export const saveChat = async (collectionId: string, messages: Message[]) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Add timestamp to new messages that don't have one
  const messagesWithTimestamp = messages.map(msg => ({
    ...msg,
    timestamp: msg.timestamp || new Date().toISOString()
  }));

  const { data: existingChat, error: fetchError } = await supabase
    .from('chats')
    .select('*')
    .eq('collection_id', collectionId)
    .eq('user_id', user.id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (existingChat) {
    // Update existing chat
    const { error } = await supabase
      .from('chats')
      .update({
        messages: messagesWithTimestamp,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingChat.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return existingChat.id;
  } else {
    // Create new chat
    const { data, error } = await supabase
      .from('chats')
      .insert({
        collection_id: collectionId,
        user_id: user.id,
        messages: messagesWithTimestamp
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }
};

export const loadChat = async (collectionId: string): Promise<Message[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('chats')
    .select('messages')
    .eq('collection_id', collectionId)
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data?.messages || []) as Message[];
};

export const deleteChat = async (chatId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', user.id);

  if (error) throw error;
};

export const getAllChats = async (collectionId: string): Promise<Chat[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('collection_id', collectionId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}; 