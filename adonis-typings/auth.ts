/*
 * @adonisjs/auth
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

declare module '@ioc:Adonis/Addons/Auth' {
  import { IocContract } from '@adonisjs/fold'
  import { HashersList } from '@ioc:Adonis/Core/Hash'
  import { QueryClientContract } from '@ioc:Adonis/Lucid/Database'
  import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
  import { DatabaseQueryBuilderContract } from '@ioc:Adonis/Lucid/DatabaseQueryBuilder'
  import { ModelContract, ModelConstructorContract, ModelQueryBuilderContract } from '@ioc:Adonis/Lucid/Model'

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  /**
   * Unwrap promise
   */
  type UnwrapPromise<T> = T extends PromiseLike<infer PT> ? PT : never
  type UnWrapAuthenticableUser<T> = T extends AuthenticatableContract<any> ? Exclude<T['user'], null> : T

  /**
   * Returns provider user by excluding null from it
   */
  export type GetProviderUser<
    Provider extends keyof ProvidersList
  > = UnWrapAuthenticableUser<UnwrapPromise<ReturnType<ProvidersList[Provider]['implementation']['findByUid']>>>

  /*
  |--------------------------------------------------------------------------
  | Providers
  |--------------------------------------------------------------------------
  */

  /**
   * Authenticatable user that works as a bridge between providers
   * and authenticators
   */
  export interface AuthenticatableContract<User extends any> {
    user: User | null,
    getId (): string | number | null,
    verifyPassword: (plainPassword: string) => Promise<boolean>,
    getRememberMeToken (): string | null,
    setRememberMeToken (token: string): void,
  }

  /**
   * The interface that every provider must implement
   */
  export interface ProvidersContract<User extends any> {
    /**
     * Find a user using the primary key value
     */
    findById (id: string | number): Promise<AuthenticatableContract<User>>,

    /**
     * Find a user by searching for their uids
     */
    findByUid (uid: string): Promise<AuthenticatableContract<User>>,

    /**
     * Find a user using the remember me token
     */
    findByToken (userId: string | number, token: string): Promise<AuthenticatableContract<User>>,

    /**
     * Update remember token
     */
    updateRememberMeToken (authenticatable: AuthenticatableContract<User>): Promise<void>
  }

  /*
  |--------------------------------------------------------------------------
  | Lucid Provider
  |--------------------------------------------------------------------------
  */

  /**
   * The shape of the user model accepted by the Lucid provider. The model
   * must have `password` and `rememberMeToken` attributes.
   */
  export type LucidProviderUser = ModelConstructorContract<ModelContract & {
    password: string,
    rememberMeToken?: string | null,
  }>

  /**
   * Shape of lucid authenticatable builder
   */
  export interface LucidAuthenticatableBuilder<User extends LucidProviderUser> {
    new (
      user: InstanceType<User> | null,
      config: LucidProviderConfig<User>,
      ...args: any[],
    ): AuthenticatableContract<InstanceType<User>>,
  }

  /**
   * Lucid provider
   */
  export interface LucidProviderContract<User extends LucidProviderUser> extends ProvidersContract<InstanceType<User>> {
    /**
     * Define a custom connection for all the provider queries
     */
    setConnection (connection: string | QueryClientContract): this

    /**
     * Before hooks
     */
    before (event: 'findUser', callback: (query: ModelQueryBuilderContract<User>) => Promise<void>): this

    /**
     * After hooks
     */
    after (event: 'findUser', callback: (user: InstanceType<User>) => Promise<void>): this
  }

  /**
   * The config accepted by the Lucid provider
   */
  export type LucidProviderConfig<User extends LucidProviderUser> = {
    driver: 'lucid',
    uids: string[],
    identifierKey: string,
    connection?: string,
    hashDriver?: keyof HashersList,
    model: User,
    authenticatable: LucidAuthenticatableBuilder<User>,
  }

  /*
  |--------------------------------------------------------------------------
  | Database Provider
  |--------------------------------------------------------------------------
  */

  /**
   * Shape of the user returned by the database provider. The table must have `password`
   * and `remember_me_token` columns.
   */
  export type DatabaseProviderUser = {
    password: string,
    remember_me_token?: string,
    [key: string]: any,
  }

  /**
   * Shape of lucid authenticatable builder
   */
  export interface DatabaseAuthenticatableBuilder {
    new (
      user: DatabaseProviderUser | null,
      config: DatabaseProviderConfig,
      ...args: any[],
    ): AuthenticatableContract<DatabaseProviderUser>,
  }

  /**
   * Database provider
   */
  export interface DatabaseProviderContract<User extends DatabaseProviderUser> extends ProvidersContract<User> {
    /**
     * Define a custom connection for all the provider queries
     */
    setConnection (connection: string | QueryClientContract): this

    /**
     * Before hooks
     */
    before (event: 'findUser', callback: (query: DatabaseQueryBuilderContract) => Promise<void>): this

    /**
     * After hooks
     */
    after (event: 'findUser', callback: (user: DatabaseProviderUser) => Promise<void>): this
  }

  /**
   * The config accepted by the Database provider
   */
  export type DatabaseProviderConfig = {
    driver: 'database',
    uids: string[],
    identifierKey: string,
    authenticatable: DatabaseAuthenticatableBuilder,
    connection?: string,
    hashDriver?: keyof HashersList,
    usersTable: string,
  }

  /*
  |--------------------------------------------------------------------------
  | Session Driver
  |--------------------------------------------------------------------------
  */

  /**
   * Shape of session driver config.
   */
  export type SessionDriverConfig<Provider extends keyof ProvidersList> = {
    driver: 'session',
    identifier?: string,
    provider: ProvidersList[Provider]['config'],
  }

  /**
   * Shape of data emitted by the login event
   */
  export type SessionLoginEventData<Provider extends keyof ProvidersList> = [
    string, GetProviderUser<Provider>, HttpContextContract, string | null,
  ]

  /**
   * Shape of data emitted by the authenticate event
   */
  export type SessionAuthenticateEventData<Provider extends keyof ProvidersList> = [
    string, GetProviderUser<Provider>, HttpContextContract, boolean,
  ]

  /**
   * Shape of the session driver
   */
  export interface SessionDriverContract<Provider extends keyof ProvidersList> {
    /**
     * Reference to the logged in user.
     */
    user?: GetProviderUser<Provider>

    /**
     * A boolean to know if user is a guest or not. It is
     * always opposite of [[isLoggedIn]]
     */
    isGuest: boolean

    /**
     * A boolean to know if user is logged in or not
     */
    isLoggedIn: boolean

    /**
     * A boolean to know if user is retrieved by authenticating
     * the current request or not.
     */
    isAuthenticated: boolean

    /**
     * Whether or not the authentication has been attempted
     * for the current request
     */
    authenticationAttempted: boolean

    /**
     * Find if the user has been logged out in the current request
     */
    isLoggedOut: boolean

    /**
     * A boolean to know if user is loggedin via remember me token
     * or not.
     */
    viaRemember: boolean

    /**
     * Reference to the provider for looking up the user
     */
    provider: ProvidersList[Provider]['implementation']

    /**
     * Verify user credentials. An Exception is raised when unable
     * to find user or the password is incorrects
     */
    verifyCredentials (uid: string, password: string): Promise<GetProviderUser<Provider>>

    /**
     * Attempt to verify user credentials and set their login session
     * when credentials are correct.
     */
    attempt (uid: string, password: string, remember?: boolean): Promise<GetProviderUser<Provider>>

    /**
     * Login a user without any verification
     */
    login (user: GetProviderUser<Provider>, remember?: boolean): Promise<void>

    /**
     * Login a user using their id
     */
    loginViaId (id: string | number, remember?: boolean): Promise<void>

    /**
     * Attempts to authenticate the user for the current HTTP request. An exception
     * is raised when unable to do so
     */
    authenticate (): Promise<void>

    /**
     * Attempts to authenticate the user for the current HTTP request and supresses
     * exceptions raised by the [[authenticate]] method and returns a boolean
     */
    check (): Promise<boolean>

    /**
     * Logout user by clearing up the session and the tokens
     */
    logout (recycleRememberToken?: boolean): Promise<void>
  }

  /*
  |--------------------------------------------------------------------------
  | Auth User Land List
  |--------------------------------------------------------------------------
  */

  /**
   * List of providers mappings used by the app. Using declaration
   * merging, one must extend this interface.
   *
   * MUST BE SET IN THE USER LAND.
   *
   * Example:
   *
   * lucid: {
   *   config: LucidProviderConfig<any>,
   *   implementation: LucidProviderContract<any>,
   * }
   *
   */
  export interface ProvidersList {
  }

  /**
   * List of authenticators mappings used by the app. Using declaration
   * merging, one must extend this interface.
   *
   * MUST BE SET IN THE USER LAND.
   *
   * Example:
   *
   * session: {
   *   config: SessionDriverConfig<'lucid'>,
   *   implementation: SessionDriverContract<'lucid'>,
   * }
   *
   */
  export interface AuthenticatorsList {
  }

  /*
  |--------------------------------------------------------------------------
  | Auth
  |--------------------------------------------------------------------------
  */

  /**
   * Shape of config accepted by the Auth module. It relies on the authenticator
   * list interface
   */
  export interface AuthConfig {
    authenticator: keyof AuthenticatorsList,
    authenticators: { [P in keyof AuthenticatorsList]: AuthenticatorsList[P]['config'] },
  }

  /**
   * Instance of the auth contract. The `use` method can be used to obtain
   * an instance of a given authenticator mapping
   */
  export interface AuthContract<
    Authenticators = {
      [P in keyof AuthenticatorsList]: AuthenticatorsList[P]['implementation']
    },
  > {
    use<K extends keyof Authenticators> (authenticator: K): Authenticators[K]
  }

  /*
  |--------------------------------------------------------------------------
  | Auth Manager
  |--------------------------------------------------------------------------
  */

  /**
   * Shape of the callback accepted to add new user providers
   */
  export type ExtendProviderCallback = (container: IocContract, config: any) => ProvidersContract<any>

  /**
   * Shape of the callback accepted to add new authenticators
   */
  export type ExtendAuthenticatorCallback = (
    container: IocContract,
    mapping: string,
    config: any,
    ctx: HttpContextContract,
    provider: ProvidersContract<any>,
  ) => any

  /**
   * Shape of the auth manager to register custom drivers and providers and
   * make instances of them
   */
  export interface AuthManagerContract {
    /**
     * Returns the instance of [[AuthContract]] for a given HTTP request
     */
    getAuthForRequest (ctx: HttpContextContract): AuthContract,

    /**
     * Returns the name for the default mapping
     */
    getDefaultMappingName (): keyof AuthenticatorsList

    /**
     * Make instance of a mapping
     */
    makeMapping<
      K extends keyof AuthenticatorsList
    > (ctx: HttpContextContract, mapping?: K): AuthenticatorsList[K]['implementation']

    /**
     * Extend by adding custom providers and authenticators
     */
    extend (type: 'provider', provider: string, callback: ExtendProviderCallback): void
    extend (type: 'authenticator', provider: string, callback: ExtendAuthenticatorCallback): void
  }

  const Auth: AuthContract

  export const LucidAuthenticatable: LucidAuthenticatableBuilder<LucidProviderUser>
  export const DatabaseAuthenticatable: DatabaseAuthenticatableBuilder
  export default Auth
}
