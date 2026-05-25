cmake_minimum_required(VERSION 3.10)

project(StatusAPI CXX)

set(CMAKE_CXX_COMPILER clang++)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE)
        set(CMAKE_BUILD_TYPE Debug)
endif()

# DEBUG FLAGS
set(CMAKE_CXX_FLAGS_DEBUG "-g -Wall -Wextra -Wuninitialized -O0 -Iinclude")

# PROD FLAGS 
set(CMAKE_CXX_FLAGS_RELEASE "-O3")

# find_package(OpenSSL REQUIRED)
#
# if (NOT OPENSSL_FOUND)
#         message(FATAL_ERROR "OpenSSL library not found!")
# endif()

add_executable(api main.cc)

# target_link_libraries(api PRIVATE OpenSSL::SSL OpenSSL::Crypto)
